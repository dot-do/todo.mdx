/**
 * Development Workflow
 *
 * Cloudflare Workflow that automatically develops issues when they become ready.
 * Uses durable execution with step.do() and step.waitForEvent().
 *
 * Triggered by:
 * - issue.ready events (when issue has no blockers)
 * - Manual invocation via API
 *
 * Flow:
 * 1. Receive issue ready event
 * 2. Spawn Claude to implement the issue (durable)
 * 3. Create PR with the changes (durable)
 * 4. Wait for PR approval (step.waitForEvent - can pause for days)
 * 5. Merge PR (durable)
 * 6. Close issue (durable)
 * 7. Dependent issues unblock automatically
 */

import { WorkflowEntrypoint, WorkflowStep as CFWorkflowStep, WorkflowEvent } from 'cloudflare:workers'
import { createRuntime } from 'agents.mdx'
import { durableTransport, type WorkflowStep } from 'agents.mdx/cloudflare-workflows'
import type { Issue, Repo } from 'agents.mdx'
import { withRetry, isTransientError, createRetryableError, type RetryConfig } from './retry'

// ============================================================================
// Retry Configuration
// ============================================================================

/** Default retry configuration for sandbox operations */
const SANDBOX_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  jitterFactor: 0.3,
  logPrefix: '[DevelopWorkflow]',
}

// ============================================================================
// Workflow Event Payload
// ============================================================================

export interface DevelopWorkflowPayload {
  /** The repository to work in */
  repo: Repo

  /** The issue to implement */
  issue: Issue

  /** GitHub installation ID for API access */
  installationId: number

  /** Optional context from TODO.mdx rendering */
  context?: string

  /** Optional agent configuration (capabilities, focus, autonomy) */
  agentConfig?: import('../agents/base').AgentDef
}

// ============================================================================
// Workflow Environment
// ============================================================================

interface WorkflowEnv {
  // Service bindings
  PAYLOAD: any // PayloadRPC
  Sandbox: any // Sandbox

  // API keys
  ANTHROPIC_API_KEY: string

  // GitHub App
  GITHUB_APP_ID: string
  GITHUB_PRIVATE_KEY: string
}

// ============================================================================
// Development Workflow
// ============================================================================

export class DevelopWorkflow extends WorkflowEntrypoint<WorkflowEnv, DevelopWorkflowPayload> {
  async run(
    event: WorkflowEvent<DevelopWorkflowPayload>,
    step: CFWorkflowStep
  ): Promise<void> {
    const { repo, issue, installationId, context, agentConfig } = event.payload

    console.log(`[DevelopWorkflow] Starting for issue ${issue.id}: ${issue.title}`)
    if (agentConfig) {
      console.log(`[DevelopWorkflow] Agent: ${agentConfig.name} (${agentConfig.id})`)
      console.log(`[DevelopWorkflow] Tier: ${agentConfig.tier}, Model: ${agentConfig.model}`)
    }

    // Create durable runtime
    // Cast step to our WorkflowStep interface for durableTransport
    const runtime = createRuntime({
      repo,
      issue,
      transport: durableTransport(step as unknown as WorkflowStep, {
        repo,
        payloadBinding: this.env.PAYLOAD,
        claudeBinding: this.env.Sandbox,
        installationId,
        stepPrefix: issue.id, // Prefix all steps with issue ID for clarity
        githubEnv: {
          GITHUB_APP_ID: this.env.GITHUB_APP_ID,
          GITHUB_PRIVATE_KEY: this.env.GITHUB_PRIVATE_KEY,
        },
      }),
    })

    // Step 1: Update issue status to in_progress
    await runtime.issues.update(issue.id, {
      status: 'in_progress',
    })

    // Step 2: Spawn Claude to implement the issue with push mode
    // This creates a branch and pushes the changes directly
    // Wrapped with retry logic for transient sandbox failures
    const branch = `${issue.id}-${slugify(issue.title)}`

    const sandboxResult = await withRetry(
      async () => {
        const res = await runtime.claude.do({
          task: issue.title,
          context: context || (await runtime.todo.render()),
          push: true,
          targetBranch: branch,
          commitMessage: `feat(${issue.id}): ${issue.title}`,
        })
        return res
      },
      {
        ...SANDBOX_RETRY_CONFIG,
        // Custom retry detection for sandbox-specific errors
        isRetryable: (error) => {
          // Check for transient errors first
          const { retryable } = isTransientError(error)
          if (retryable) return true

          // Also retry on sandbox-specific transient failures
          if (error instanceof Error) {
            const message = error.message.toLowerCase()
            // Sandbox container startup issues
            if (message.includes('container') && message.includes('failed')) return true
            // Sandbox resource exhaustion (temporary)
            if (message.includes('resource') && message.includes('exhausted')) return true
            // Sandbox connection issues
            if (message.includes('sandbox') && message.includes('connection')) return true
          }
          return false
        },
      }
    )

    if (!sandboxResult.success) {
      console.error(`[DevelopWorkflow] Sandbox execution failed after ${sandboxResult.attempts} attempts`)
      throw sandboxResult.error
    }

    const result = sandboxResult.value!
    console.log(`[DevelopWorkflow] Sandbox execution succeeded after ${sandboxResult.attempts} attempt(s)`)

    console.log(`[DevelopWorkflow] Claude completed implementation:`)
    console.log(`  Files changed: ${result.filesChanged.length}`)
    console.log(`  Branch: ${result.pushedToBranch}`)
    console.log(`  Summary: ${result.summary}`)

    // If no files changed, nothing to do
    if (result.filesChanged.length === 0) {
      console.log(`[DevelopWorkflow] No files changed, closing issue as resolved`)
      await runtime.issues.close(issue.id, 'No changes needed')
      return
    }

    // Step 3: Create a pull request (branch already pushed by Claude)
    const pr = await runtime.pr.create({
      branch: result.pushedToBranch || branch,
      title: issue.title,
      body: `Closes #${issue.id}\n\n${result.summary}\n\n## Changes\n\`\`\`diff\n${result.diff.slice(0, 10000)}\n\`\`\``,
    })

    console.log(`[DevelopWorkflow] Created PR #${pr.number}: ${pr.url}`)

    // Step 4: Request code review from Claude
    // Wrapped with retry logic for transient sandbox failures
    const reviewResult = await withRetry(
      async () => {
        return runtime.claude.review({
          pr,
          focus: ['security', 'correctness', 'performance'],
        })
      },
      SANDBOX_RETRY_CONFIG
    )

    if (!reviewResult.success) {
      console.error(`[DevelopWorkflow] Code review failed after ${reviewResult.attempts} attempts`)
      throw reviewResult.error
    }

    const review = reviewResult.value!
    console.log(`[DevelopWorkflow] Code review completed after ${reviewResult.attempts} attempt(s)`)

    if (!review.approved) {
      console.log(`[DevelopWorkflow] Review failed with ${review.comments.length} comments`)

      // Add review comments to PR
      await runtime.pr.comment(
        pr,
        `## Code Review Feedback\n\n${review.summary}\n\n` +
        review.comments
          .map((c) => `- **${c.file}:${c.line}** (${c.severity}): ${c.body}`)
          .join('\n')
      )

      // Update issue with review feedback
      await runtime.issues.update(issue.id, {
        status: 'blocked',
      })

      throw new Error(
        `Code review failed: ${review.summary}. Manual intervention required.`
      )
    }

    console.log(`[DevelopWorkflow] Code review approved: ${review.summary}`)

    // Step 5: Wait for PR approval (step.waitForEvent)
    // This pauses the workflow until approval webhook is received
    // Can wait for days/weeks without holding resources
    console.log(`[DevelopWorkflow] Waiting for PR approval...`)

    await runtime.pr.waitForApproval(pr, {
      timeout: '7d', // Wait up to 7 days
    })

    console.log(`[DevelopWorkflow] PR approved!`)

    // Step 6: Merge the PR
    await runtime.pr.merge(pr)

    console.log(`[DevelopWorkflow] Merged PR #${pr.number}`)

    // Step 7: Close the issue
    await runtime.issues.close(issue.id, 'Completed via automated workflow')

    console.log(`[DevelopWorkflow] Closed issue ${issue.id}`)

    // Step 8: Notify dependent repos (multi-repo coordination)
    // This allows cross-repo dependencies to unblock
    await step.do(`notify-dependent-repos-${issue.id}`, async () => {
      await this.notifyDependentRepos(repo, issue.id)
    })

    console.log(`[DevelopWorkflow] Notified dependent repos`)

    // Done! Local dependent issues unblock automatically via beads
    // Cross-repo dependent issues will be notified and trigger their workflows
  }

  /**
   * Notify repos that have cross-repo dependencies on this issue
   */
  private async notifyDependentRepos(repo: Repo, issueId: string): Promise<void> {
    // In a full implementation, we would:
    // 1. Query a central registry for repos that depend on this issue
    // 2. For each dependent repo, call their /notify/issue-closed endpoint
    //
    // For now, this is handled by:
    // - Cross-repo deps stored in each repo's RepoDO
    // - Repos can poll /cross-deps/check or receive webhooks
    //
    // A more sophisticated implementation would use:
    // - Cloudflare Pub/Sub for event fanout
    // - D1 registry of all cross-repo dependencies
    // - Webhook subscriptions between repos

    console.log(`[DevelopWorkflow] Issue ${issueId} in ${repo.owner}/${repo.name} completed`)
    console.log(`[DevelopWorkflow] Cross-repo dependents will check their dependency status on next poll`)
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert string to slug (kebab-case)
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) // Limit length for branch names
}

// ============================================================================
// Workflow Trigger Helpers
// ============================================================================

/**
 * Helper to trigger this workflow from outside
 *
 * @example
 * // In webhook handler when issue becomes ready:
 * const instance = await env.DEVELOP_WORKFLOW.create({
 *   params: {
 *     repo,
 *     issue,
 *     installationId,
 *   }
 * })
 */
export async function triggerDevelopWorkflow(
  env: WorkflowEnv & { DEVELOP_WORKFLOW: WorkflowNamespace },
  payload: DevelopWorkflowPayload
): Promise<WorkflowInstance> {
  const id = `develop-${payload.issue.id}-${Date.now()}`

  const instance = await env.DEVELOP_WORKFLOW.create({
    id,
    params: payload,
  })

  return instance
}

// Types for workflow instances (from Cloudflare Workflows)
interface WorkflowNamespace {
  create(options: { id: string; params: DevelopWorkflowPayload }): Promise<WorkflowInstance>
  get(id: string): Promise<WorkflowInstance>
}

interface WorkflowInstance {
  id: string
  status: 'running' | 'complete' | 'failed' | 'paused'
  pause(): Promise<void>
  resume(): Promise<void>
  terminate(): Promise<void>
  /** Send an event to a waiting workflow step */
  sendEvent(event: { type: string; payload?: unknown }): Promise<void>
}
