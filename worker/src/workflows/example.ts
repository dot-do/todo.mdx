/**
 * Example: Using Cloudflare Workflows with agents.mdx
 *
 * This file shows a complete example of:
 * 1. Creating a workflow
 * 2. Using durable transport
 * 3. Handling long waits with step.waitForEvent
 * 4. Integrating with webhooks
 */

import { Workflow, WorkflowStep, WorkflowEvent } from 'cloudflare:workflows'
import { createRuntime } from 'agents.mdx'
import { durableTransport } from 'agents.mdx/cloudflare-workflows'
import type { Issue, Repo } from 'agents.mdx'

// ============================================================================
// Simple Example: Auto-implement and merge
// ============================================================================

interface SimpleWorkflowPayload {
  repo: Repo
  issue: Issue
  installationId: number
}

/**
 * Minimal workflow showing the core pattern
 */
export class SimpleAutoDevWorkflow extends Workflow<any, SimpleWorkflowPayload> {
  async run(
    event: WorkflowEvent<SimpleWorkflowPayload>,
    step: WorkflowStep
  ): Promise<void> {
    const { repo, issue, installationId } = event.payload

    // Create runtime with durable transport
    const runtime = createRuntime({
      repo,
      issue,
      transport: durableTransport(step, {
        repo,
        payloadBinding: this.env.PAYLOAD,
        installationId,
      }),
    })

    // Step 1: Implement (durable)
    const result = await runtime.claude.do({
      task: issue.title,
    })

    // Step 2: Create PR (durable)
    const pr = await runtime.pr.create({
      branch: `auto/${issue.id}`,
      title: issue.title,
      body: result.summary,
    })

    // Step 3: Wait for approval (pauses workflow)
    await runtime.pr.waitForApproval(pr)

    // Step 4: Merge (durable)
    await runtime.pr.merge(pr)

    // Step 5: Close issue (durable)
    await runtime.issues.close(issue.id)
  }
}

// ============================================================================
// Advanced Example: Multi-step with retries and notifications
// ============================================================================

/**
 * Production-ready workflow with error handling
 */
export class ProductionDevWorkflow extends Workflow<any, SimpleWorkflowPayload> {
  async run(
    event: WorkflowEvent<SimpleWorkflowPayload>,
    step: WorkflowStep
  ): Promise<void> {
    const { repo, issue, installationId } = event.payload

    const runtime = createRuntime({
      repo,
      issue,
      transport: durableTransport(step, {
        repo,
        payloadBinding: this.env.PAYLOAD,
        installationId,
        stepPrefix: issue.id, // All steps prefixed with issue ID
      }),
    })

    // Mark issue as in progress
    await runtime.issues.update(issue.id, { status: 'in_progress' })

    // Implementation phase
    let implementationAttempts = 0
    let result

    while (implementationAttempts < 3) {
      try {
        result = await runtime.claude.do({
          task: issue.title,
          context: await runtime.todo.render(),
        })
        break
      } catch (error) {
        implementationAttempts++

        if (implementationAttempts >= 3) {
          await runtime.issues.update(issue.id, {
            status: 'blocked',
          })
          throw new Error(`Implementation failed after 3 attempts: ${error}`)
        }

        // Wait before retry (exponential backoff)
        await step.sleep(`${Math.pow(2, implementationAttempts)}m`)
      }
    }

    // Create PR
    const pr = await runtime.pr.create({
      branch: `${issue.id}-${slugify(issue.title)}`,
      title: issue.title,
      body: `Closes #${issue.id}\n\n${result.summary}`,
    })

    // Code review
    const review = await runtime.claude.review({
      pr,
      focus: ['security', 'correctness'],
    })

    if (!review.approved) {
      await runtime.pr.comment(pr, `## Review Feedback\n\n${review.summary}`)
      await runtime.issues.update(issue.id, { status: 'blocked' })
      throw new Error('Code review failed')
    }

    // Wait for human approval
    await runtime.pr.waitForApproval(pr, { timeout: '7d' })

    // Merge
    await runtime.pr.merge(pr)

    // Close issue
    await runtime.issues.close(issue.id, 'Completed via workflow')
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

// ============================================================================
// Webhook Integration Example
// ============================================================================

/**
 * Add to worker/src/index.ts:
 *
 * ```typescript
 * // Trigger workflow when issue becomes ready
 * app.post('/api/issue/ready', async (c) => {
 *   const { issue, repo, installationId } = await c.req.json()
 *
 *   const instance = await c.env.SIMPLE_WORKFLOW.create({
 *     id: `auto-dev-${issue.id}`,
 *     params: { issue, repo, installationId }
 *   })
 *
 *   return c.json({
 *     workflowId: instance.id,
 *     status: instance.status
 *   })
 * })
 *
 * // Send approval event when PR is approved
 * app.post('/github/webhook', async (c) => {
 *   const payload = await c.req.json()
 *
 *   if (payload.action === 'submitted' && payload.review?.state === 'approved') {
 *     const pr = payload.pull_request
 *     const issueId = extractIssueId(pr.body)
 *
 *     if (issueId) {
 *       // The workflow will automatically resume when this event is received
 *       // Event name: pr.${pr.number}.approved
 *       console.log(`PR #${pr.number} approved, workflow will resume`)
 *     }
 *   }
 *
 *   return c.json({ status: 'ok' })
 * })
 * ```
 */

// ============================================================================
// wrangler.toml Configuration
// ============================================================================

/**
 * ```toml
 * [[workflows]]
 * binding = "SIMPLE_WORKFLOW"
 * name = "simple-auto-dev"
 * class_name = "SimpleAutoDevWorkflow"
 *
 * [[workflows]]
 * binding = "PRODUCTION_WORKFLOW"
 * name = "production-dev"
 * class_name = "ProductionDevWorkflow"
 * ```
 */
