/**
 * Autonomous Orchestration Workflow
 *
 * Cloudflare Workflow that chains the full autonomous SDLC pipeline:
 * 1. Parse Phase: Accept issue/task details
 * 2. Execute Phase: Call ClaudeCodeAgent.do() with the task
 * 3. Verify Phase: Check test results from the agent's artifacts
 * 4. PR Phase: If tests pass, create branch and pull request
 * 5. Complete Phase: Update issue status, post summary comment
 *
 * This is the capstone for autonomous development - a single workflow
 * that takes an issue and produces a tested, reviewed PR.
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers'
import {
  withRetry,
  isTransientError,
  createRetryableError,
  type RetryConfig,
} from './retry'
import { ClaudeCodeAgent, type ClaudeCodeDoOptions } from '../agents/impl/claude-code'
import type { TestResult } from '../sandbox/claude'

// ============================================================================
// Workflow Payload
// ============================================================================

export interface AutonomousPayload {
  /** beads/RepoDO issue ID */
  issueId: string

  /** Repository in owner/repo format */
  repoFullName: string

  /** GitHub App installation ID for API access */
  installationId: number

  /** The work to be done (task description) */
  task: string

  /** Optional target branch name (auto-generated if not provided) */
  branch?: string

  /** Auto-merge on approval (default: false) */
  autoMerge?: boolean
}

// ============================================================================
// Workflow Result
// ============================================================================

export interface AutonomousResult {
  /** Whether the entire workflow succeeded */
  success: boolean

  /** Current phase when completed/failed */
  phase: 'parse' | 'execute' | 'verify' | 'pr' | 'complete'

  /** Error message if failed */
  error?: string

  /** Execution summary from Claude Code */
  executionSummary?: string

  /** Test results if tests were run */
  testResults?: TestResult

  /** PR details if created */
  pullRequest?: {
    number: number
    url: string
    branch: string
  }

  /** Issue status after completion */
  issueStatus?: string
}

// ============================================================================
// Retry Configuration
// ============================================================================

/** Retry config for sandbox operations (longer timeouts, more retries) */
const SANDBOX_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 2000,
  maxDelay: 60000,
  jitterFactor: 0.3,
  logPrefix: '[AutonomousWorkflow:Sandbox]',
  isRetryable: (error) => {
    const { retryable } = isTransientError(error)
    if (retryable) return true

    // Sandbox-specific transient failures
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      if (message.includes('container') && message.includes('failed')) return true
      if (message.includes('resource') && message.includes('exhausted')) return true
      if (message.includes('sandbox') && message.includes('connection')) return true
      if (message.includes('timeout')) return true
    }
    return false
  },
}

/** Retry config for GitHub API operations */
const GITHUB_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  jitterFactor: 0.3,
  logPrefix: '[AutonomousWorkflow:GitHub]',
}

/** Retry config for RepoDO operations */
const REPO_DO_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 500,
  maxDelay: 10000,
  jitterFactor: 0.2,
  logPrefix: '[AutonomousWorkflow:RepoDO]',
}

// ============================================================================
// Workflow Environment
// ============================================================================

interface WorkflowEnv {
  // Durable Objects
  REPO: DurableObjectNamespace
  Sandbox: DurableObjectNamespace

  // API keys
  ANTHROPIC_API_KEY: string

  // GitHub App
  GITHUB_APP_ID: string
  GITHUB_PRIVATE_KEY: string
}

// ============================================================================
// Autonomous Workflow
// ============================================================================

export class AutonomousWorkflow extends WorkflowEntrypoint<WorkflowEnv, AutonomousPayload> {
  async run(
    event: WorkflowEvent<AutonomousPayload>,
    step: WorkflowStep
  ): Promise<AutonomousResult> {
    const {
      issueId,
      repoFullName,
      installationId,
      task,
      branch: providedBranch,
      autoMerge = false,
    } = event.payload

    console.log(`[AutonomousWorkflow] Starting for issue ${issueId} in ${repoFullName}`)
    console.log(`[AutonomousWorkflow] Task: ${task.slice(0, 100)}...`)

    // ========================================================================
    // Phase 1: Parse - Validate inputs and prepare context
    // ========================================================================
    const parseResult = await step.do('parse-phase', async () => {
      console.log(`[AutonomousWorkflow] Phase 1: Parse`)

      // Validate required inputs
      if (!issueId || !repoFullName || !task) {
        throw new Error('Missing required inputs: issueId, repoFullName, or task')
      }

      // Generate branch name if not provided
      const branch = providedBranch || this.generateBranchName(issueId, task)

      // Update issue status to in_progress
      const doId = this.env.REPO.idFromName(repoFullName)
      const stub = this.env.REPO.get(doId)

      const updateResult = await withRetry(
        async () => {
          const response = await stub.fetch(new Request(`http://do/issues/${issueId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'in_progress' }),
          }))

          if (!response.ok) {
            const errorText = await response.text()
            if (response.status >= 500 || response.status === 429) {
              throw createRetryableError(
                `Failed to update issue: ${response.status} ${errorText}`,
                response.status === 429 ? 'rate_limit' : 'server_error',
                { statusCode: response.status }
              )
            }
            throw new Error(`Failed to update issue: ${response.status} ${errorText}`)
          }

          return response.json()
        },
        REPO_DO_RETRY_CONFIG
      )

      if (!updateResult.success) {
        console.warn(`[AutonomousWorkflow] Failed to update issue status: ${updateResult.error?.message}`)
        // Continue anyway - status update is not critical
      }

      return { branch, issueId, repoFullName, task }
    })

    // ========================================================================
    // Phase 2: Execute - Run ClaudeCodeAgent with task
    // ========================================================================

    // We run the agent outside step.do() since DoResult contains non-serializable data.
    // The step.do() is used for the wrapper that handles retries and returns simple data.
    let executeResult: {
      success: boolean
      output: string
      artifacts: Array<{ type: string; ref: string; url?: string; data?: unknown }>
    }

    try {
      // Execute the agent (this is the actual work - not in step.do for serializability)
      const agentResult = await (async () => {
        console.log(`[AutonomousWorkflow] Phase 2: Execute`)

        // Create ClaudeCodeAgent instance
        const agent = new ClaudeCodeAgent(
          {
            id: `autonomous-${issueId}`,
            name: 'Autonomous Developer',
            description: 'Autonomous SDLC agent',
            tools: ['code', 'test', 'commit'],
            tier: 'sandbox',
            model: 'best',
            framework: 'claude-code',
          },
          this.env as any, // Env type matches
          {
            repo: repoFullName,
            installationId,
            branch: parseResult.branch,
            push: true,
            targetBranch: parseResult.branch,
            commitMessage: `feat(${issueId}): ${task.slice(0, 50)}`,
          }
        )

        // Execute with retry logic
        const result = await withRetry(
          async () => {
            const doOptions: ClaudeCodeDoOptions = {
              stream: false, // Workflow doesn't need streaming
              runTests: true, // Always run tests in autonomous mode
            }

            const res = await agent.do(task, doOptions)

            // Check for execution errors that might be transient
            if (!res.success && res.output) {
              const output = res.output.toLowerCase()
              if (
                output.includes('connection') ||
                output.includes('timeout') ||
                output.includes('resource exhausted')
              ) {
                throw createRetryableError(
                  `Execution failed with transient error: ${res.output}`,
                  'network',
                  { cause: new Error(res.output) }
                )
              }
            }

            return res
          },
          SANDBOX_RETRY_CONFIG
        )

        if (!result.success) {
          throw result.error || new Error('Execution failed')
        }

        // Return a serializable version (events are not serializable)
        const value = result.value!
        return {
          success: value.success,
          output: value.output,
          // Serialize artifacts to plain objects (remove any non-serializable data)
          artifacts: (value.artifacts || []).map(a => ({
            type: a.type,
            ref: a.ref,
            url: a.url,
            // Stringify and reparse data to ensure serializability
            data: a.data !== undefined ? JSON.parse(JSON.stringify(a.data)) : undefined,
          })),
        }
      })()

      executeResult = agentResult
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[AutonomousWorkflow] Execute phase failed: ${errorMessage}`)

      // Update issue status to blocked
      await this.updateIssueStatus(repoFullName, issueId, 'blocked', `Execution failed: ${errorMessage}`)

      return {
        success: false,
        phase: 'execute',
        error: errorMessage,
      }
    }

    // ========================================================================
    // Phase 3: Verify - Check test results
    // ========================================================================
    let testResults: TestResult | undefined
    const verifyResult = await step.do('verify-phase', async () => {
      console.log(`[AutonomousWorkflow] Phase 3: Verify`)

      // Extract test results from artifacts
      const artifacts = executeResult.artifacts || []
      const testArtifact = artifacts.find(a => a.type === 'test-results')

      if (!testArtifact) {
        console.log(`[AutonomousWorkflow] No test results found in artifacts`)
        return { testsPass: true, testResults: undefined }
      }

      const results = testArtifact.data as TestResult | { error: string }

      if ('error' in results) {
        console.error(`[AutonomousWorkflow] Test execution error: ${results.error}`)
        return { testsPass: false, testResults: undefined, error: results.error }
      }

      testResults = results
      const testsPass = results.failed === 0

      console.log(`[AutonomousWorkflow] Tests: ${results.passed} passed, ${results.failed} failed, ${results.skipped} skipped`)

      return { testsPass, testResults: results }
    })

    if (!verifyResult.testsPass) {
      const errorMessage = verifyResult.error || `Tests failed: ${testResults?.failed || 0} failures`
      console.error(`[AutonomousWorkflow] Verify phase failed: ${errorMessage}`)

      // Update issue status to blocked
      await this.updateIssueStatus(repoFullName, issueId, 'blocked', errorMessage)

      return {
        success: false,
        phase: 'verify',
        error: errorMessage,
        executionSummary: executeResult.output,
        testResults,
      }
    }

    // ========================================================================
    // Phase 4: PR - Create pull request if branch was pushed
    // ========================================================================
    let pullRequest: { number: number; url: string; branch: string } | undefined

    // Check if we have a pushed branch in artifacts
    const artifacts = executeResult.artifacts || []
    const branchArtifact = artifacts.find(a => a.type === 'branch')
    const pushedBranch = branchArtifact?.ref || parseResult.branch

    if (branchArtifact || artifacts.some(a => a.type === 'commit')) {
      try {
        pullRequest = await step.do('pr-phase', async () => {
          console.log(`[AutonomousWorkflow] Phase 4: PR`)

          // Get Octokit for GitHub API
          const octokit = await this.getOctokit(installationId)
          const [owner, repo] = repoFullName.split('/')

          // Get default branch
          const { data: repoData } = await octokit.repos.get({ owner, repo })
          const baseBranch = repoData.default_branch

          // Create pull request with retry
          const prResult = await withRetry(
            async () => {
              const { data } = await octokit.pulls.create({
                owner,
                repo,
                title: `feat(${issueId}): ${task.slice(0, 50)}`,
                head: pushedBranch,
                base: baseBranch,
                body: this.generatePRBody(issueId, task, executeResult, testResults),
              })

              return {
                number: data.number,
                url: data.html_url,
                branch: pushedBranch,
              }
            },
            GITHUB_RETRY_CONFIG
          )

          if (!prResult.success) {
            throw prResult.error || new Error('Failed to create PR')
          }

          console.log(`[AutonomousWorkflow] Created PR #${prResult.value!.number}: ${prResult.value!.url}`)
          return prResult.value!
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[AutonomousWorkflow] PR phase failed: ${errorMessage}`)

        // Update issue with partial success - code done but PR failed
        await this.updateIssueStatus(repoFullName, issueId, 'blocked', `PR creation failed: ${errorMessage}`)

        return {
          success: false,
          phase: 'pr',
          error: errorMessage,
          executionSummary: executeResult.output,
          testResults,
        }
      }
    } else {
      console.log(`[AutonomousWorkflow] No branch pushed, skipping PR creation`)
    }

    // ========================================================================
    // Phase 5: Complete - Update issue and post summary
    // ========================================================================
    await step.do('complete-phase', async () => {
      console.log(`[AutonomousWorkflow] Phase 5: Complete`)

      const doId = this.env.REPO.idFromName(repoFullName)
      const stub = this.env.REPO.get(doId)

      // Post completion comment
      if (pullRequest) {
        await withRetry(
          async () => {
            const response = await stub.fetch(new Request(`http://do/issues/${issueId}/comments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                body: this.generateCompletionComment(pullRequest!, executeResult, testResults),
              }),
            }))

            if (!response.ok && response.status >= 500) {
              throw createRetryableError(
                `Failed to post comment: ${response.status}`,
                'server_error',
                { statusCode: response.status }
              )
            }
          },
          REPO_DO_RETRY_CONFIG
        )
      }

      // Update issue status - leave open (PR not merged yet) but note work is done
      await withRetry(
        async () => {
          const response = await stub.fetch(new Request(`http://do/issues/${issueId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'open', // Back to open, waiting for PR review/merge
              notes: pullRequest
                ? `Implementation complete. PR #${pullRequest.number} awaiting review.`
                : 'Implementation complete. No changes required.',
            }),
          }))

          if (!response.ok && response.status >= 500) {
            throw createRetryableError(
              `Failed to update issue: ${response.status}`,
              'server_error',
              { statusCode: response.status }
            )
          }
        },
        REPO_DO_RETRY_CONFIG
      )
    })

    console.log(`[AutonomousWorkflow] Completed successfully for issue ${issueId}`)

    return {
      success: true,
      phase: 'complete',
      executionSummary: executeResult.output,
      testResults,
      pullRequest,
      issueStatus: 'open',
    }
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Generate a branch name from issue ID and task
   */
  private generateBranchName(issueId: string, task: string): string {
    const slug = task
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)

    return `${issueId}/${slug}`
  }

  /**
   * Get authenticated Octokit instance
   */
  private async getOctokit(installationId: number) {
    const { Octokit } = await import('@octokit/rest')
    const { createAppAuth } = await import('@octokit/auth-app')

    const auth = createAppAuth({
      appId: this.env.GITHUB_APP_ID,
      privateKey: this.env.GITHUB_PRIVATE_KEY,
      installationId,
    })

    const { token } = await auth({ type: 'installation' })
    return new Octokit({ auth: token })
  }

  /**
   * Update issue status in RepoDO
   */
  private async updateIssueStatus(
    repoFullName: string,
    issueId: string,
    status: string,
    notes?: string
  ): Promise<void> {
    const doId = this.env.REPO.idFromName(repoFullName)
    const stub = this.env.REPO.get(doId)

    await withRetry(
      async () => {
        const response = await stub.fetch(new Request(`http://do/issues/${issueId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, notes }),
        }))

        if (!response.ok && response.status >= 500) {
          throw createRetryableError(
            `Failed to update issue: ${response.status}`,
            'server_error',
            { statusCode: response.status }
          )
        }
      },
      REPO_DO_RETRY_CONFIG
    )
  }

  /**
   * Generate PR body with execution summary
   */
  private generatePRBody(
    issueId: string,
    task: string,
    result: { success: boolean; output: string; artifacts: Array<{ type: string; ref: string; url?: string; data?: unknown }> },
    testResults?: TestResult
  ): string {
    const artifacts = result.artifacts || []
    const filesChanged = artifacts
      .filter(a => a.type === 'file')
      .map(a => `- \`${a.ref}\``)
      .join('\n')

    const testSummary = testResults
      ? `**Tests:** ${testResults.passed} passed, ${testResults.failed} failed, ${testResults.skipped} skipped (${testResults.duration}ms)`
      : 'No tests run'

    return `## Summary

Closes #${issueId}

${task}

## Changes

${filesChanged || 'No files changed'}

## Test Results

${testSummary}

## Execution Summary

${result.output?.slice(0, 2000) || 'No summary available'}

---
*Generated by Autonomous Workflow*
`
  }

  /**
   * Generate completion comment for the issue
   */
  private generateCompletionComment(
    pr: { number: number; url: string; branch: string },
    result: { success: boolean; output: string; artifacts: Array<{ type: string; ref: string; url?: string; data?: unknown }> },
    testResults?: TestResult
  ): string {
    const testSummary = testResults
      ? `- Tests: ${testResults.passed} passed, ${testResults.failed} failed`
      : '- Tests: Not run'

    const artifacts = result.artifacts || []
    return `## Implementation Complete

Created PR #${pr.number}: ${pr.url}

**Summary:**
- Branch: \`${pr.branch}\`
- Files changed: ${artifacts.filter(a => a.type === 'file').length}
${testSummary}

The implementation is ready for review and merge.

---
*Generated by Autonomous Workflow*
`
  }
}

// ============================================================================
// Workflow Trigger Helper
// ============================================================================

/**
 * Trigger the autonomous workflow
 *
 * @example
 * const instance = await triggerAutonomousWorkflow(env, {
 *   issueId: 'todo-abc1',
 *   repoFullName: 'owner/repo',
 *   installationId: 12345,
 *   task: 'Implement the feature described in the issue',
 * })
 */
export async function triggerAutonomousWorkflow(
  env: WorkflowEnv & { AUTONOMOUS_WORKFLOW: WorkflowNamespace },
  payload: AutonomousPayload
): Promise<WorkflowInstance> {
  const id = `autonomous-${payload.issueId}-${Date.now()}`

  const instance = await env.AUTONOMOUS_WORKFLOW.create({
    id,
    params: payload,
  })

  return instance
}

// Types for workflow instances (from Cloudflare Workflows)
interface WorkflowNamespace {
  create(options: { id: string; params: AutonomousPayload }): Promise<WorkflowInstance>
  get(id: string): Promise<WorkflowInstance>
}

interface WorkflowInstance {
  id: string
  status: 'running' | 'complete' | 'failed' | 'paused'
  pause(): Promise<void>
  resume(): Promise<void>
  terminate(): Promise<void>
  sendEvent(event: { type: string; payload?: unknown }): Promise<void>
}
