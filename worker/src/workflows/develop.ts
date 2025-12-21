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
}

// ============================================================================
// Workflow Environment
// ============================================================================

interface WorkflowEnv {
  // Service bindings
  PAYLOAD: any // PayloadRPC
  CLAUDE_SANDBOX: any // ClaudeSandbox

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
    const { repo, issue, installationId, context } = event.payload

    console.log(`[DevelopWorkflow] Starting for issue ${issue.id}: ${issue.title}`)

    // Create durable runtime
    // Cast step to our WorkflowStep interface for durableTransport
    const runtime = createRuntime({
      repo,
      issue,
      transport: durableTransport(step as unknown as WorkflowStep, {
        repo,
        payloadBinding: this.env.PAYLOAD,
        claudeBinding: this.env.CLAUDE_SANDBOX,
        installationId,
        stepPrefix: issue.id, // Prefix all steps with issue ID for clarity
      }),
    })

    // Step 1: Update issue status to in_progress
    await runtime.issues.update(issue.id, {
      status: 'in_progress',
    })

    // Step 2: Spawn Claude to implement the issue
    // This is wrapped in step.do() automatically by durableTransport
    const result = await runtime.claude.do({
      task: issue.title,
      context: context || (await runtime.todo.render()),
    })

    console.log(`[DevelopWorkflow] Claude completed implementation:`)
    console.log(`  Files changed: ${result.filesChanged.length}`)
    console.log(`  Summary: ${result.summary}`)

    // Step 3: Create a pull request
    const branch = `${issue.id}-${slugify(issue.title)}`
    const pr = await runtime.pr.create({
      branch,
      title: issue.title,
      body: `Closes #${issue.id}\n\n${result.summary}\n\n## Changes\n${result.diff}`,
    })

    console.log(`[DevelopWorkflow] Created PR #${pr.number}: ${pr.url}`)

    // Step 4: Request code review from Claude
    const review = await runtime.claude.review({
      pr,
      focus: ['security', 'correctness', 'performance'],
    })

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

    // Done! Dependent issues will unblock automatically via beads
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
