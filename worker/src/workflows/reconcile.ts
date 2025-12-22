/**
 * Reconcile Workflow
 *
 * Cloudflare Workflow that periodically syncs issues from RepoDO to D1/Payload.
 * Runs every 5 minutes via cron trigger.
 *
 * Flow:
 * 1. Query all repos from D1 with syncEnabled=true
 * 2. For each repo, get RepoDO stub via env.REPO.idFromName(repo.fullName)
 * 3. Fetch issues from RepoDO via stub.fetch('http://do/issues')
 * 4. Upsert each issue to D1 issues table
 * 5. Track conflicts (issue changed in both systems since last sync)
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers'
import { eq, and, isNotNull } from 'drizzle-orm'
import { createDrizzle, repos, issues as issuesTable, installations } from '../db/drizzle'
import type { Issue as IssueRow, Repo as RepoRow } from '../db/schema'
import {
  withRetry,
  fetchWithRetry,
  isTransientError,
  createRetryableError,
  type RetryConfig,
} from './retry'

// ============================================================================
// Retry Configuration
// ============================================================================

/** Default retry configuration for RepoDO fetch operations */
const REPO_DO_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  jitterFactor: 0.3,
  logPrefix: '[ReconcileWorkflow:RepoDO]',
}

/** Default retry configuration for D1 database operations */
const D1_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 500,
  maxDelay: 10000,
  jitterFactor: 0.2,
  logPrefix: '[ReconcileWorkflow:D1]',
  // Custom retry detection for D1-specific errors
  isRetryable: (error) => {
    // Check for standard transient errors first
    const { retryable } = isTransientError(error)
    if (retryable) return true

    // D1-specific transient failures
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      // D1 connection issues
      if (message.includes('d1') && message.includes('connection')) return true
      // Database locked (temporary)
      if (message.includes('database') && message.includes('locked')) return true
      // Busy/overloaded
      if (message.includes('busy') || message.includes('overloaded')) return true
      // SQL constraint failures are NOT retryable
      if (message.includes('constraint') || message.includes('unique')) return false
    }
    return false
  },
}

// ============================================================================
// Workflow Payload
// ============================================================================

export interface ReconcilePayload {
  /** Optional: specific repo to reconcile (if not provided, reconcile all) */
  repoFullName?: string
}

// ============================================================================
// Workflow Environment
// ============================================================================

interface WorkflowEnv {
  DB: D1Database
  REPO: DurableObjectNamespace
}

// ============================================================================
// RepoDO Issue Format (from RepoDO's internal schema)
// ============================================================================

interface RepoDOIssue {
  id: string
  title: string
  description: string
  design: string
  acceptance_criteria: string
  notes: string
  status: 'open' | 'in_progress' | 'blocked' | 'closed'
  priority: number
  issue_type: 'bug' | 'feature' | 'task' | 'epic' | 'chore'
  assignee: string | null
  created_at: string
  updated_at: string
  closed_at: string | null
  close_reason: string
  external_ref: string | null
  github_number: number | null
  github_id: number | null
  last_sync_at: string | null
  labels?: string[]
  dependencies?: Array<{
    issue_id: string
    depends_on_id: string
    type: string
    created_at: string
    created_by: string
  }>
  dependents?: Array<{
    issue_id: string
    depends_on_id: string
    type: string
  }>
}

// ============================================================================
// Conflict Detection
// ============================================================================

interface SyncConflict {
  issueId: string
  beadsId: string
  repoFullName: string
  reason: string
  repoDOUpdatedAt: string
  d1UpdatedAt: string
}

// ============================================================================
// Sync Result
// ============================================================================

interface SyncResult {
  reposProcessed: number
  issuesCreated: number
  issuesUpdated: number
  conflicts: SyncConflict[]
  errors: Array<{ repo: string; error: string }>
}

// ============================================================================
// Reconcile Workflow
// ============================================================================

export class ReconcileWorkflow extends WorkflowEntrypoint<WorkflowEnv, ReconcilePayload> {
  async run(
    event: WorkflowEvent<ReconcilePayload>,
    step: WorkflowStep
  ): Promise<SyncResult> {
    const { repoFullName } = event.payload

    console.log(`[ReconcileWorkflow] Starting reconciliation${repoFullName ? ` for ${repoFullName}` : ' for all repos'}`)

    const result: SyncResult = {
      reposProcessed: 0,
      issuesCreated: 0,
      issuesUpdated: 0,
      conflicts: [],
      errors: [],
    }

    // Step 1: Fetch repos to reconcile
    const reposToSync = await step.do('fetch-repos', async () => {
      const db = createDrizzle(this.env.DB)

      if (repoFullName) {
        // Sync specific repo
        const repoRows = await db
          .select()
          .from(repos)
          .where(
            and(
              eq(repos.fullName, repoFullName),
              eq(repos.syncEnabled, true)
            )
          )
          .limit(1)
        return repoRows
      }

      // Sync all enabled repos
      const repoRows = await db
        .select()
        .from(repos)
        .where(eq(repos.syncEnabled, true))

      return repoRows
    })

    console.log(`[ReconcileWorkflow] Found ${reposToSync.length} repos to sync`)

    if (reposToSync.length === 0) {
      return result
    }

    // Step 2: Process each repo
    for (const repo of reposToSync) {
      const repoResult = await step.do(`sync-repo-${repo.fullName}`, async () => {
        return this.syncRepo(repo)
      })

      result.reposProcessed++
      result.issuesCreated += repoResult.created
      result.issuesUpdated += repoResult.updated
      result.conflicts.push(...repoResult.conflicts)
      if (repoResult.error) {
        result.errors.push({ repo: repo.fullName, error: repoResult.error })
      }
    }

    console.log(`[ReconcileWorkflow] Completed reconciliation:`)
    console.log(`  Repos: ${result.reposProcessed}`)
    console.log(`  Created: ${result.issuesCreated}`)
    console.log(`  Updated: ${result.issuesUpdated}`)
    console.log(`  Conflicts: ${result.conflicts.length}`)
    console.log(`  Errors: ${result.errors.length}`)

    return result
  }

  /**
   * Sync a single repo's issues from RepoDO to D1
   */
  private async syncRepo(repo: RepoRow): Promise<{
    created: number
    updated: number
    conflicts: SyncConflict[]
    error?: string
  }> {
    const db = createDrizzle(this.env.DB)

    try {
      // Get RepoDO stub
      const doId = this.env.REPO.idFromName(repo.fullName)
      const stub = this.env.REPO.get(doId)

      // Fetch all issues from RepoDO with retry logic
      const fetchResult = await withRetry(
        async () => {
          const response = await stub.fetch(new Request('http://do/issues'))

          if (!response.ok) {
            const errorText = await response.text()
            // Treat 5xx and 429 as retryable
            if (response.status >= 500 || response.status === 429) {
              throw createRetryableError(
                `RepoDO fetch failed: ${response.status} ${errorText}`,
                response.status === 429 ? 'rate_limit' : 'server_error',
                { statusCode: response.status }
              )
            }
            // 4xx errors (except 429) are not retryable
            throw new Error(`RepoDO fetch failed: ${response.status} ${errorText}`)
          }

          return response.json() as Promise<RepoDOIssue[]>
        },
        {
          ...REPO_DO_RETRY_CONFIG,
          logPrefix: `[ReconcileWorkflow:RepoDO:${repo.fullName}]`,
        }
      )

      if (!fetchResult.success) {
        console.error(`[ReconcileWorkflow] Failed to fetch issues from ${repo.fullName} after ${fetchResult.attempts} attempts`)
        return {
          created: 0,
          updated: 0,
          conflicts: [],
          error: fetchResult.error?.message || 'Failed to fetch from RepoDO',
        }
      }

      const doIssues = fetchResult.value!
      console.log(`[ReconcileWorkflow] Fetched ${doIssues.length} issues from ${repo.fullName} (${fetchResult.attempts} attempt(s))`)

      let created = 0
      let updated = 0
      const conflicts: SyncConflict[] = []
      const now = new Date().toISOString()

      // Process each issue with retry logic for D1 operations
      for (const doIssue of doIssues) {
        const issueResult = await withRetry(
          async () => {
            // Check if issue exists in D1 by beadsId (localId) or githubNumber
            const existing = await db
              .select()
              .from(issuesTable)
              .where(
                and(
                  eq(issuesTable.repoId, repo.id),
                  eq(issuesTable.localId, doIssue.id)
                )
              )
              .limit(1)

            if (existing.length > 0) {
              const existingIssue = existing[0]

              // Conflict detection: check if both sides changed since last sync
              const existingUpdatedAt = new Date(existingIssue.updatedAt).getTime()
              const doUpdatedAt = new Date(doIssue.updated_at).getTime()
              const lastSyncAt = doIssue.last_sync_at
                ? new Date(doIssue.last_sync_at).getTime()
                : 0

              // If both changed after last sync, we have a conflict
              if (lastSyncAt > 0 && existingUpdatedAt > lastSyncAt && doUpdatedAt > lastSyncAt) {
                return {
                  action: 'conflict' as const,
                  conflict: {
                    issueId: String(existingIssue.id),
                    beadsId: doIssue.id,
                    repoFullName: repo.fullName,
                    reason: 'Both D1 and RepoDO modified since last sync',
                    repoDOUpdatedAt: doIssue.updated_at,
                    d1UpdatedAt: existingIssue.updatedAt,
                  },
                }
              }

              // Update existing issue (RepoDO is source of truth for beads data)
              await db
                .update(issuesTable)
                .set({
                  title: doIssue.title,
                  body: doIssue.description || null,
                  status: doIssue.status,
                  priority: doIssue.priority,
                  type: doIssue.issue_type,
                  labels: doIssue.labels ? JSON.stringify(doIssue.labels) : null,
                  closedAt: doIssue.closed_at || null,
                  closeReason: doIssue.close_reason || null,
                  githubNumber: doIssue.github_number || null,
                  githubId: doIssue.github_id || null,
                  updatedAt: now,
                })
                .where(eq(issuesTable.id, existingIssue.id))

              return { action: 'updated' as const }
            } else {
              // Create new issue
              await db
                .insert(issuesTable)
                .values({
                  localId: doIssue.id,
                  title: doIssue.title,
                  body: doIssue.description || null,
                  state: doIssue.status === 'closed' ? 'closed' : 'open',
                  status: doIssue.status,
                  priority: doIssue.priority,
                  type: doIssue.issue_type,
                  labels: doIssue.labels ? JSON.stringify(doIssue.labels) : null,
                  repoId: repo.id,
                  githubNumber: doIssue.github_number || null,
                  githubId: doIssue.github_id || null,
                  closedAt: doIssue.closed_at || null,
                  closeReason: doIssue.close_reason || null,
                  createdAt: doIssue.created_at,
                  updatedAt: now,
                })

              return { action: 'created' as const }
            }
          },
          {
            ...D1_RETRY_CONFIG,
            logPrefix: `[ReconcileWorkflow:D1:${doIssue.id}]`,
          }
        )

        if (issueResult.success && issueResult.value) {
          const { action } = issueResult.value
          if (action === 'created') {
            created++
          } else if (action === 'updated') {
            updated++
          } else if (action === 'conflict' && issueResult.value.conflict) {
            conflicts.push(issueResult.value.conflict)
          }
        } else {
          console.error(`[ReconcileWorkflow] Error processing issue ${doIssue.id} after ${issueResult.attempts} attempts:`, issueResult.error)
        }
      }

      // Update repo lastSyncAt with retry logic
      const updateResult = await withRetry(
        async () => {
          await db
            .update(repos)
            .set({
              lastSyncAt: now,
              syncStatus: 'idle',
              syncError: null,
              updatedAt: now,
            })
            .where(eq(repos.id, repo.id))
        },
        {
          ...D1_RETRY_CONFIG,
          logPrefix: `[ReconcileWorkflow:D1:repo-update:${repo.fullName}]`,
        }
      )

      if (!updateResult.success) {
        console.error(`[ReconcileWorkflow] Failed to update repo sync status for ${repo.fullName}:`, updateResult.error)
      }

      return { created, updated, conflicts }
    } catch (error) {
      console.error(`[ReconcileWorkflow] Error syncing repo ${repo.fullName}:`, error)

      // Update repo with error status (with retry)
      const errorUpdateResult = await withRetry(
        async () => {
          await db
            .update(repos)
            .set({
              syncStatus: 'error',
              syncError: String(error),
              updatedAt: new Date().toISOString(),
            })
            .where(eq(repos.id, repo.id))
        },
        {
          ...D1_RETRY_CONFIG,
          maxRetries: 1, // Fewer retries for error status update
          logPrefix: `[ReconcileWorkflow:D1:repo-error:${repo.fullName}]`,
        }
      )

      if (!errorUpdateResult.success) {
        console.error(`[ReconcileWorkflow] Failed to update repo error status for ${repo.fullName}:`, errorUpdateResult.error)
      }

      return {
        created: 0,
        updated: 0,
        conflicts: [],
        error: String(error),
      }
    }
  }
}
