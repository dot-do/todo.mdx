/**
 * Sync Orchestrator for GitHub ↔ Beads bidirectional sync
 *
 * Orchestrates webhook processing, push/pull operations, and conflict resolution.
 */

import type { WebhookEvent } from './webhook'
import type { BeadsIssue } from './beads-to-github'
import type { GitHubClient, GitHubIssue } from './github-client'
import type { Installation, IssueMapping } from './entities'
import type { GitHubConventions } from './conventions'
import { convertGitHubToBeads } from './github-to-beads'
import { convertBeadsToGitHub } from './beads-to-github'

export type ConflictStrategy = 'github-wins' | 'beads-wins' | 'newest-wins'

export interface SyncConflict {
  beadsId: string
  githubNumber: number
  beadsUpdatedAt: string
  githubUpdatedAt: string
  resolution: 'github' | 'beads' | 'skipped'
}

export interface SyncResult {
  created: { beadsId: string; githubNumber?: number }[]
  updated: { beadsId: string; githubNumber: number }[]
  conflicts: SyncConflict[]
  errors: { id: string; error: string }[]
}

export interface SyncOrchestrator {
  // Process a webhook event from GitHub
  processWebhookEvent(event: WebhookEvent): Promise<SyncResult>

  // Push beads changes to GitHub
  pushToGitHub(beadsIssues: BeadsIssue[]): Promise<SyncResult>

  // Pull GitHub issues to beads
  pullFromGitHub(): Promise<SyncResult>

  // Full bidirectional sync with conflict resolution
  sync(options?: { strategy?: ConflictStrategy }): Promise<SyncResult>
}

export interface SyncOrchestratorOptions {
  installation: Installation
  githubClient: GitHubClient
  conventions: GitHubConventions
  conflictStrategy?: ConflictStrategy

  // Callbacks for beads operations (injected for testability)
  beadsOps: {
    getIssue(id: string): Promise<BeadsIssue | null>
    createIssue(issue: BeadsIssue): Promise<BeadsIssue>
    updateIssue(id: string, issue: Partial<BeadsIssue>): Promise<BeadsIssue>
    listIssues(): Promise<BeadsIssue[]>
  }

  // Callbacks for mapping operations (injected for testability)
  mappingOps: {
    getMapping(beadsId: string): Promise<IssueMapping | null>
    getMappingByGitHub(number: number): Promise<IssueMapping | null>
    createMapping(mapping: Omit<IssueMapping, '$type' | '$id'>): Promise<IssueMapping>
    updateMapping(id: string, data: Partial<IssueMapping>): Promise<IssueMapping>
  }
}

/**
 * Create a sync orchestrator instance
 */
export function createSyncOrchestrator(
  options: SyncOrchestratorOptions
): SyncOrchestrator {
  const {
    installation,
    githubClient,
    conventions,
    conflictStrategy = 'newest-wins',
    beadsOps,
    mappingOps,
  } = options

  // Track processed webhook delivery IDs to prevent duplicates
  const processedDeliveryIds = new Set<string>()

  /**
   * Create an empty sync result
   */
  function createEmptyResult(): SyncResult {
    return {
      created: [],
      updated: [],
      conflicts: [],
      errors: [],
    }
  }

  /**
   * Merge two sync results
   */
  function mergeResults(a: SyncResult, b: SyncResult): SyncResult {
    return {
      created: [...a.created, ...b.created],
      updated: [...a.updated, ...b.updated],
      conflicts: [...a.conflicts, ...b.conflicts],
      errors: [...a.errors, ...b.errors],
    }
  }

  /**
   * Process a webhook event from GitHub
   */
  async function processWebhookEvent(event: WebhookEvent): Promise<SyncResult> {
    const result = createEmptyResult()

    // Check for duplicate delivery
    if (processedDeliveryIds.has(event.deliveryId)) {
      return result // Skip duplicate
    }

    processedDeliveryIds.add(event.deliveryId)

    // Only process issues events
    if (event.event !== 'issues') {
      return result // Skip non-issue events
    }

    const ghIssue = event.payload.issue as GitHubIssue

    try {
      // Check if mapping exists
      const mapping = await mappingOps.getMappingByGitHub(ghIssue.number)

      if (event.action === 'opened' || (event.action === 'edited' && !mapping)) {
        // Create new beads issue
        const beadsIssue = convertGitHubToBeads(ghIssue, {
          conventions,
          owner: installation.owner,
          repo: installation.repo,
        })

        const created = await beadsOps.createIssue(beadsIssue)

        // Create mapping
        await mappingOps.createMapping({
          installationId: installation.$id,
          beadsId: created.id!,
          githubNumber: ghIssue.number,
          githubUrl: ghIssue.html_url,
          lastSyncedAt: new Date().toISOString(),
          beadsUpdatedAt: ghIssue.updated_at,
          githubUpdatedAt: ghIssue.updated_at,
        })

        result.created.push({
          beadsId: created.id!,
          githubNumber: ghIssue.number,
        })
      } else if (mapping) {
        // Update existing beads issue
        const beadsIssue = convertGitHubToBeads(ghIssue, {
          conventions,
          owner: installation.owner,
          repo: installation.repo,
        })

        await beadsOps.updateIssue(mapping.beadsId, beadsIssue)

        // Update mapping timestamps
        await mappingOps.updateMapping(mapping.$id, {
          lastSyncedAt: new Date().toISOString(),
          githubUpdatedAt: ghIssue.updated_at,
        })

        result.updated.push({
          beadsId: mapping.beadsId,
          githubNumber: ghIssue.number,
        })
      }
    } catch (error) {
      result.errors.push({
        id: `gh-${ghIssue.number}`,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    return result
  }

  /**
   * Push beads issues to GitHub
   */
  async function pushToGitHub(beadsIssues: BeadsIssue[]): Promise<SyncResult> {
    const result = createEmptyResult()

    for (const beadsIssue of beadsIssues) {
      try {
        const mapping = await mappingOps.getMapping(beadsIssue.id!)

        if (!mapping) {
          // Create new GitHub issue
          const ghPayload = convertBeadsToGitHub(beadsIssue, { conventions })

          const created = await githubClient.createIssue(
            installation.owner,
            installation.repo,
            ghPayload
          )

          // Create mapping
          await mappingOps.createMapping({
            installationId: installation.$id,
            beadsId: beadsIssue.id!,
            githubNumber: created.number,
            githubUrl: created.html_url,
            lastSyncedAt: new Date().toISOString(),
            beadsUpdatedAt: beadsIssue.updatedAt,
            githubUpdatedAt: created.updated_at,
          })

          result.created.push({
            beadsId: beadsIssue.id!,
            githubNumber: created.number,
          })
        } else {
          // Update existing GitHub issue
          const ghPayload = convertBeadsToGitHub(beadsIssue, { conventions })

          const updated = await githubClient.updateIssue(
            installation.owner,
            installation.repo,
            mapping.githubNumber,
            ghPayload
          )

          // Update mapping timestamps
          await mappingOps.updateMapping(mapping.$id, {
            lastSyncedAt: new Date().toISOString(),
            beadsUpdatedAt: beadsIssue.updatedAt,
            githubUpdatedAt: updated.updated_at,
          })

          result.updated.push({
            beadsId: beadsIssue.id!,
            githubNumber: mapping.githubNumber,
          })
        }
      } catch (error) {
        result.errors.push({
          id: beadsIssue.id!,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return result
  }

  /**
   * Pull GitHub issues to beads
   */
  async function pullFromGitHub(): Promise<SyncResult> {
    const result = createEmptyResult()

    try {
      // Fetch all GitHub issues
      const ghIssues = await githubClient.listIssues(
        installation.owner,
        installation.repo,
        { state: 'all' }
      )

      for (const ghIssue of ghIssues) {
        try {
          const mapping = await mappingOps.getMappingByGitHub(ghIssue.number)

          if (!mapping) {
            // Create new beads issue
            const beadsIssue = convertGitHubToBeads(ghIssue, {
              conventions,
              owner: installation.owner,
              repo: installation.repo,
            })

            const created = await beadsOps.createIssue(beadsIssue)

            // Create mapping
            await mappingOps.createMapping({
              installationId: installation.$id,
              beadsId: created.id!,
              githubNumber: ghIssue.number,
              githubUrl: ghIssue.html_url,
              lastSyncedAt: new Date().toISOString(),
              beadsUpdatedAt: ghIssue.updated_at,
              githubUpdatedAt: ghIssue.updated_at,
            })

            result.created.push({
              beadsId: created.id!,
              githubNumber: ghIssue.number,
            })
          } else {
            // Update existing beads issue
            const beadsIssue = convertGitHubToBeads(ghIssue, {
              conventions,
              owner: installation.owner,
              repo: installation.repo,
            })

            await beadsOps.updateIssue(mapping.beadsId, beadsIssue)

            // Update mapping timestamps
            await mappingOps.updateMapping(mapping.$id, {
              lastSyncedAt: new Date().toISOString(),
              githubUpdatedAt: ghIssue.updated_at,
            })

            result.updated.push({
              beadsId: mapping.beadsId,
              githubNumber: ghIssue.number,
            })
          }
        } catch (error) {
          result.errors.push({
            id: `gh-${ghIssue.number}`,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    } catch (error) {
      result.errors.push({
        id: 'pull',
        error: error instanceof Error ? error.message : String(error),
      })
    }

    return result
  }

  /**
   * Determine which version wins based on strategy
   */
  function resolveConflict(
    beadsUpdatedAt: string,
    githubUpdatedAt: string,
    strategy: ConflictStrategy
  ): 'github' | 'beads' {
    if (strategy === 'github-wins') {
      return 'github'
    }

    if (strategy === 'beads-wins') {
      return 'beads'
    }

    // newest-wins
    const beadsTime = new Date(beadsUpdatedAt).getTime()
    const githubTime = new Date(githubUpdatedAt).getTime()

    if (githubTime > beadsTime) {
      return 'github'
    } else if (beadsTime > githubTime) {
      return 'beads'
    } else {
      // Equal timestamps - default to GitHub
      return 'github'
    }
  }

  /**
   * Full bidirectional sync with conflict resolution
   */
  async function sync(options?: {
    strategy?: ConflictStrategy
  }): Promise<SyncResult> {
    const strategy = options?.strategy || conflictStrategy
    const result = createEmptyResult()

    try {
      // Fetch all issues from both systems
      const beadsIssues = await beadsOps.listIssues()
      const ghIssues = await githubClient.listIssues(
        installation.owner,
        installation.repo,
        { state: 'all' }
      )

      // Build a map of GitHub issues by number for quick lookup
      const ghIssueMap = new Map<number, GitHubIssue>()
      for (const ghIssue of ghIssues) {
        ghIssueMap.set(ghIssue.number, ghIssue)
      }

      // Process beads issues
      for (const beadsIssue of beadsIssues) {
        try {
          const mapping = await mappingOps.getMapping(beadsIssue.id!)

          if (!mapping) {
            // No mapping - create on GitHub
            const ghPayload = convertBeadsToGitHub(beadsIssue, { conventions })
            const created = await githubClient.createIssue(
              installation.owner,
              installation.repo,
              ghPayload
            )

            await mappingOps.createMapping({
              installationId: installation.$id,
              beadsId: beadsIssue.id!,
              githubNumber: created.number,
              githubUrl: created.html_url,
              lastSyncedAt: new Date().toISOString(),
              beadsUpdatedAt: beadsIssue.updatedAt,
              githubUpdatedAt: created.updated_at,
            })

            result.created.push({
              beadsId: beadsIssue.id!,
              githubNumber: created.number,
            })
          } else {
            // Has mapping - check for conflict
            const ghIssue = ghIssueMap.get(mapping.githubNumber)

            if (ghIssue) {
              // Remove from map so we know it was processed
              ghIssueMap.delete(mapping.githubNumber)

              // Check if either side has been updated since last sync
              const beadsUpdated =
                beadsIssue.updatedAt !== mapping.beadsUpdatedAt
              const githubUpdated =
                ghIssue.updated_at !== mapping.githubUpdatedAt

              // If either side changed, apply conflict resolution strategy
              if (beadsUpdated || githubUpdated) {
                const resolution = resolveConflict(
                  beadsIssue.updatedAt,
                  ghIssue.updated_at,
                  strategy
                )

                // Always record as conflict when using sync() and something changed
                // This helps track all resolution decisions made during sync
                result.conflicts.push({
                  beadsId: beadsIssue.id!,
                  githubNumber: mapping.githubNumber,
                  beadsUpdatedAt: beadsIssue.updatedAt,
                  githubUpdatedAt: ghIssue.updated_at,
                  resolution,
                })

                if (resolution === 'github') {
                  // Update beads from GitHub
                  const convertedBeads = convertGitHubToBeads(ghIssue, {
                    conventions,
                    owner: installation.owner,
                    repo: installation.repo,
                  })
                  const updatedBeads = await beadsOps.updateIssue(beadsIssue.id!, convertedBeads)

                  await mappingOps.updateMapping(mapping.$id, {
                    lastSyncedAt: new Date().toISOString(),
                    beadsUpdatedAt: updatedBeads.updatedAt,
                    githubUpdatedAt: ghIssue.updated_at,
                  })
                } else {
                  // Update GitHub from beads
                  const ghPayload = convertBeadsToGitHub(beadsIssue, {
                    conventions,
                  })
                  const updated = await githubClient.updateIssue(
                    installation.owner,
                    installation.repo,
                    mapping.githubNumber,
                    ghPayload
                  )

                  await mappingOps.updateMapping(mapping.$id, {
                    lastSyncedAt: new Date().toISOString(),
                    beadsUpdatedAt: beadsIssue.updatedAt,
                    githubUpdatedAt: updated.updated_at,
                  })
                }

                result.updated.push({
                  beadsId: beadsIssue.id!,
                  githubNumber: mapping.githubNumber,
                })
              }
            }
          }
        } catch (error) {
          result.errors.push({
            id: beadsIssue.id!,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      // Process remaining GitHub issues (not in beads)
      for (const ghIssue of ghIssueMap.values()) {
        try {
          const beadsIssue = convertGitHubToBeads(ghIssue, {
            conventions,
            owner: installation.owner,
            repo: installation.repo,
          })

          const created = await beadsOps.createIssue(beadsIssue)

          await mappingOps.createMapping({
            installationId: installation.$id,
            beadsId: created.id!,
            githubNumber: ghIssue.number,
            githubUrl: ghIssue.html_url,
            lastSyncedAt: new Date().toISOString(),
            beadsUpdatedAt: ghIssue.updated_at,
            githubUpdatedAt: ghIssue.updated_at,
          })

          result.created.push({
            beadsId: created.id!,
            githubNumber: ghIssue.number,
          })
        } catch (error) {
          result.errors.push({
            id: `gh-${ghIssue.number}`,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    } catch (error) {
      result.errors.push({
        id: 'sync',
        error: error instanceof Error ? error.message : String(error),
      })
    }

    return result
  }

  return {
    processWebhookEvent,
    pushToGitHub,
    pullFromGitHub,
    sync,
  }
}
