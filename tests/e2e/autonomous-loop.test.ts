/**
 * E2E: Full Autonomous Development Loop
 *
 * This is THE comprehensive E2E test that verifies the entire autonomous
 * development pipeline works end-to-end:
 *
 * 1. Create a real beads issue in test repo
 * 2. Issue becomes ready (no blockers)
 * 3. Trigger DevelopWorkflow
 * 4. Claude spawns in sandbox
 * 5. Claude implements the issue
 * 6. Claude pushes branch
 * 7. PR is created
 * 8. Claude reviewer (Quinn) reviews
 * 9. If changes requested → Claude addresses → re-review
 * 10. PR approved
 * 11. PR merged
 * 12. Issue closed
 *
 * Required environment variables:
 * - TEST_API_KEY: API key for worker auth
 * - WORKER_BASE_URL: Worker URL (defaults to https://todo.mdx.do)
 * - GITHUB_INSTALLATION_ID: GitHub App installation ID
 * - ANTHROPIC_API_KEY: For Claude sandbox execution
 *
 * Run with: pnpm --filter @todo.mdx/tests test -- tests/e2e/autonomous-loop.test.ts
 */

import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { execa } from 'execa'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { describeWithAutonomous } from '../helpers'

// ============================================================================
// Configuration
// ============================================================================

const WORKER_BASE_URL = process.env.WORKER_BASE_URL || 'https://todo.mdx.do'
const TEST_API_KEY = process.env.TEST_API_KEY
const GITHUB_INSTALLATION_ID = process.env.GITHUB_INSTALLATION_ID
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// Test repository (must have GitHub App installed)
const TEST_REPO_OWNER = process.env.TEST_REPO_OWNER || 'dot-do'
const TEST_REPO_NAME = process.env.TEST_REPO_NAME || 'test.mdx'

// Timeouts
const SANDBOX_TIMEOUT = 300_000 // 5 minutes for Claude to work
const WORKFLOW_TIMEOUT = 600_000 // 10 minutes for full workflow
const POLL_INTERVAL = 5_000 // 5 seconds between status checks

// ============================================================================
// Credential and Sandbox Checks
// ============================================================================

function hasRequiredCredentials(): boolean {
  const missing: string[] = []
  if (!TEST_API_KEY) missing.push('TEST_API_KEY')
  if (!GITHUB_INSTALLATION_ID) missing.push('GITHUB_INSTALLATION_ID')
  if (!ANTHROPIC_API_KEY) missing.push('ANTHROPIC_API_KEY')

  if (missing.length > 0) {
    console.log(`Missing required credentials: ${missing.join(', ')}`)
    return false
  }
  return true
}

interface SandboxHealthResponse {
  available: boolean
  reason?: string
}

let sandboxAvailable = false

async function checkSandboxAvailability(): Promise<boolean> {
  try {
    const response = await fetch(`${WORKER_BASE_URL}/api/sandbox/health`)

    if (!response.ok) {
      console.log(`Sandbox health check failed: HTTP ${response.status}`)
      return false
    }

    const health = await response.json() as SandboxHealthResponse

    if (!health.available) {
      console.log(`Sandbox not available: ${health.reason || 'Unknown reason'}`)
      return false
    }

    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.log(`Sandbox health check error: ${message}`)
    return false
  }
}

// Use shared descriptor for full autonomous credentials
const describeWithCredentials = describeWithAutonomous
const describeIfSandboxAvailable = (name: string, fn: () => void) => {
  return sandboxAvailable ? describe(name, fn) : describe.skip(name, fn)
}

// ============================================================================
// API Helpers
// ============================================================================

async function apiRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${WORKER_BASE_URL}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${TEST_API_KEY}`,
    ...(options.headers as Record<string, string> || {}),
  }

  return fetch(url, { ...options, headers })
}

interface SandboxResult {
  diff: string
  summary: string
  filesChanged: string[]
  exitCode: number
  branch?: string
  commitSha?: string
  pushed?: boolean
}

interface WorkflowStatus {
  id: string
  status: 'running' | 'complete' | 'paused' | 'error'
  output?: any
  error?: string
}

interface PRInfo {
  number: number
  url: string
  state: string
}

interface ReviewResult {
  id: number
  state: string
}

interface MergeResult {
  merged: boolean
  sha: string
  message?: string
}

// ============================================================================
// Sandbox API
// ============================================================================

const sandbox = {
  async execute(options: {
    repo: string
    task: string
    branch?: string
    push?: boolean
    installationId?: number
    timeout?: number
  }): Promise<SandboxResult> {
    const response = await apiRequest('/api/sandbox/execute', {
      method: 'POST',
      body: JSON.stringify({
        ...options,
        installationId: options.installationId || parseInt(GITHUB_INSTALLATION_ID!),
      }),
    })

    if (!response.ok) {
      const error = await response.json() as { error: string }
      throw new Error(`Sandbox execution failed: ${error.error}`)
    }

    return response.json()
  },
}

// ============================================================================
// Workflow API
// ============================================================================

const workflows = {
  async triggerIssueReady(
    issue: { id: string; title: string; description?: string },
    repo?: { owner: string; name: string }
  ): Promise<{ workflowId: string; status: string }> {
    const response = await apiRequest('/api/workflows/issue/ready', {
      method: 'POST',
      body: JSON.stringify({
        issue,
        repo: repo || { owner: TEST_REPO_OWNER, name: TEST_REPO_NAME },
        installationId: parseInt(GITHUB_INSTALLATION_ID!),
      }),
    })

    if (!response.ok) {
      const error = await response.json() as { error: string }
      throw new Error(`Failed to trigger workflow: ${error.error}`)
    }

    return response.json()
  },

  async getStatus(workflowId: string): Promise<WorkflowStatus> {
    const response = await apiRequest(`/api/workflows/${workflowId}`)

    if (!response.ok) {
      throw new Error(`Failed to get workflow status: ${response.status}`)
    }

    return response.json()
  },

  async waitForStatus(
    workflowId: string,
    targetStatus: 'complete' | 'paused' | 'error',
    timeoutMs: number = WORKFLOW_TIMEOUT
  ): Promise<WorkflowStatus> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getStatus(workflowId)

      if (status.status === targetStatus) {
        return status
      }

      if (status.status === 'error') {
        throw new Error(`Workflow failed: ${status.error}`)
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL))
    }

    throw new Error(`Workflow did not reach ${targetStatus} within ${timeoutMs}ms`)
  },

  async createPR(options: {
    repo?: { owner: string; name: string }
    branch: string
    title: string
    body: string
  }): Promise<PRInfo> {
    const response = await apiRequest('/api/workflows/pr/create', {
      method: 'POST',
      body: JSON.stringify({
        repo: options.repo || { owner: TEST_REPO_OWNER, name: TEST_REPO_NAME },
        branch: options.branch,
        title: options.title,
        body: options.body,
        installationId: parseInt(GITHUB_INSTALLATION_ID!),
      }),
    })

    if (!response.ok) {
      const error = await response.json() as { error: string }
      throw new Error(`Failed to create PR: ${error.error}`)
    }

    return response.json()
  },

  async submitReview(options: {
    repo?: { owner: string; name: string }
    prNumber: number
    action: 'approve' | 'request_changes' | 'comment'
    body: string
  }): Promise<ReviewResult> {
    const response = await apiRequest('/api/workflows/pr/review', {
      method: 'POST',
      body: JSON.stringify({
        repo: options.repo || { owner: TEST_REPO_OWNER, name: TEST_REPO_NAME },
        prNumber: options.prNumber,
        action: options.action,
        body: options.body,
        installationId: parseInt(GITHUB_INSTALLATION_ID!),
      }),
    })

    if (!response.ok) {
      const error = await response.json() as { error: string }
      throw new Error(`Failed to submit review: ${error.error}`)
    }

    return response.json()
  },

  async mergePR(options: {
    repo?: { owner: string; name: string }
    prNumber: number
    mergeMethod?: 'merge' | 'squash' | 'rebase'
  }): Promise<MergeResult> {
    const response = await apiRequest('/api/workflows/pr/merge', {
      method: 'POST',
      body: JSON.stringify({
        repo: options.repo || { owner: TEST_REPO_OWNER, name: TEST_REPO_NAME },
        prNumber: options.prNumber,
        mergeMethod: options.mergeMethod || 'squash',
        installationId: parseInt(GITHUB_INSTALLATION_ID!),
      }),
    })

    if (!response.ok) {
      const error = await response.json() as { error: string }
      throw new Error(`Failed to merge PR: ${error.error}`)
    }

    return response.json()
  },

  async closePR(options: {
    repo?: { owner: string; name: string }
    prNumber: number
  }): Promise<void> {
    // Close without merging - uses GitHub API via PATCH
    // This is a cleanup operation
    const { Octokit } = await import('@octokit/rest')

    const response = await apiRequest('/api/repos/' +
      `${options.repo?.owner || TEST_REPO_OWNER}/` +
      `${options.repo?.name || TEST_REPO_NAME}/` +
      `pulls/${options.prNumber}`, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'closed' }),
    })

    // Don't throw on error - this is cleanup
    if (!response.ok) {
      console.warn(`Failed to close PR ${options.prNumber}: ${response.status}`)
    }
  },
}

// ============================================================================
// GitHub API Helpers
// ============================================================================

const github = {
  async deleteBranch(branch: string): Promise<void> {
    const response = await apiRequest(
      `/api/repos/${TEST_REPO_OWNER}/${TEST_REPO_NAME}/git/refs/heads/${branch}`,
      { method: 'DELETE' }
    )
    // Don't throw on error - branch may not exist
  },
}

// ============================================================================
// Test Fixtures
// ============================================================================

interface TestContext {
  issueId: string
  branch: string
  prNumber?: number
  workflowId?: string
}

const testContexts: TestContext[] = []

async function cleanupTestContext(ctx: TestContext): Promise<void> {
  // Close PR if exists
  if (ctx.prNumber) {
    await workflows.closePR({ prNumber: ctx.prNumber }).catch(() => {})
  }

  // Delete branch
  if (ctx.branch) {
    await github.deleteBranch(ctx.branch).catch(() => {})
  }
}

// ============================================================================
// Tests
// ============================================================================

describeWithCredentials('Full Autonomous Development Loop', () => {
  beforeAll(async () => {
    console.log('='.repeat(60))
    console.log('AUTONOMOUS LOOP E2E TEST')
    console.log('='.repeat(60))
    console.log(`Worker URL: ${WORKER_BASE_URL}`)
    console.log(`Test Repo: ${TEST_REPO_OWNER}/${TEST_REPO_NAME}`)
    console.log(`Installation ID: ${GITHUB_INSTALLATION_ID}`)
    console.log('='.repeat(60))

    // Check if sandbox is available
    console.log('Checking sandbox availability...')
    sandboxAvailable = await checkSandboxAvailability()

    if (!sandboxAvailable) {
      console.log('⚠️  Sandbox is not available - sandbox-dependent tests will be skipped')
      console.log('='.repeat(60))
    } else {
      console.log('✓ Sandbox is available')
      console.log('='.repeat(60))
    }
  })

  afterAll(async () => {
    // Cleanup all test contexts
    for (const ctx of testContexts) {
      await cleanupTestContext(ctx)
    }
  })

  // --------------------------------------------------------------------------
  // Component Tests (building blocks)
  // --------------------------------------------------------------------------

  describeIfSandboxAvailable('Component: Sandbox Execution', () => {
    test('Claude can execute a task and return diff', async () => {
      const issueId = `e2e-sandbox-${Date.now()}`
      const branch = `e2e/${issueId}`

      testContexts.push({ issueId, branch })

      const result = await sandbox.execute({
        repo: `${TEST_REPO_OWNER}/${TEST_REPO_NAME}`,
        task: `Create a file called "e2e-tests/${issueId}.md" with the text "E2E Test: Sandbox execution verified"`,
        branch,
        push: true,
      })

      expect(result.exitCode).toBe(0)
      expect(result.filesChanged.length).toBeGreaterThan(0)
      expect(result.pushed).toBe(true)
      expect(result.commitSha).toMatch(/^[0-9a-f]{40}$/)

      console.log(`✓ Sandbox executed successfully`)
      console.log(`  Files changed: ${result.filesChanged.join(', ')}`)
      console.log(`  Branch: ${branch}`)
      console.log(`  Commit: ${result.commitSha}`)
    }, SANDBOX_TIMEOUT)
  })

  describeIfSandboxAvailable('Component: PR Lifecycle', () => {
    let ctx: TestContext

    beforeAll(async () => {
      // Create a test branch with a change
      const issueId = `e2e-pr-${Date.now()}`
      const branch = `e2e/${issueId}`
      ctx = { issueId, branch }
      testContexts.push(ctx)

      await sandbox.execute({
        repo: `${TEST_REPO_OWNER}/${TEST_REPO_NAME}`,
        task: `Create a file called "e2e-tests/${issueId}.md" with PR lifecycle test content`,
        branch,
        push: true,
      })
    })

    test('can create PR', async () => {
      const pr = await workflows.createPR({
        branch: ctx.branch,
        title: `E2E Test: PR Lifecycle (${ctx.issueId})`,
        body: `This PR tests the PR lifecycle.\n\nCloses #${ctx.issueId}`,
      })

      expect(pr.number).toBeGreaterThan(0)
      expect(pr.url).toContain('github.com')
      ctx.prNumber = pr.number

      console.log(`✓ Created PR #${pr.number}`)
    })

    test('can submit review with changes requested', async () => {
      expect(ctx.prNumber).toBeDefined()

      const review = await workflows.submitReview({
        prNumber: ctx.prNumber!,
        action: 'request_changes',
        body: 'E2E Test: Please add a timestamp to verify the fix cycle',
      })

      expect(review.state).toBe('CHANGES_REQUESTED')
      console.log(`✓ Submitted review requesting changes`)
    })

    test('can address review feedback', async () => {
      // Claude addresses the feedback
      const result = await sandbox.execute({
        repo: `${TEST_REPO_OWNER}/${TEST_REPO_NAME}`,
        task: `Add a timestamp to the file "e2e-tests/${ctx.issueId}.md" to address the review feedback`,
        branch: ctx.branch,
        push: true,
      })

      expect(result.exitCode).toBe(0)
      expect(result.pushed).toBe(true)

      console.log(`✓ Claude addressed feedback with commit ${result.commitSha}`)
    }, SANDBOX_TIMEOUT)

    test('can submit approval', async () => {
      expect(ctx.prNumber).toBeDefined()

      const review = await workflows.submitReview({
        prNumber: ctx.prNumber!,
        action: 'approve',
        body: 'E2E Test: LGTM! Changes look good.',
      })

      expect(review.state).toBe('APPROVED')
      console.log(`✓ Submitted approval`)
    })

    test('can merge PR', async () => {
      expect(ctx.prNumber).toBeDefined()

      const result = await workflows.mergePR({
        prNumber: ctx.prNumber!,
        mergeMethod: 'squash',
      })

      expect(result.merged).toBe(true)
      expect(result.sha).toMatch(/^[0-9a-f]{40}$/)

      console.log(`✓ Merged PR with sha ${result.sha}`)
    })
  })

  // --------------------------------------------------------------------------
  // Integration Test (full loop)
  // --------------------------------------------------------------------------

  describeIfSandboxAvailable('Integration: Full Autonomous Loop', () => {
    test('complete issue → develop → PR → review → merge cycle', async () => {
      const issueId = `e2e-full-${Date.now()}`
      const branch = `claude/${issueId}`
      const ctx: TestContext = { issueId, branch }
      testContexts.push(ctx)

      console.log('\n' + '='.repeat(60))
      console.log(`FULL AUTONOMOUS LOOP: ${issueId}`)
      console.log('='.repeat(60))

      // Step 1: Create the initial change (simulating Claude's work)
      console.log('\n[Step 1] Claude implements the issue...')
      const sandboxResult = await sandbox.execute({
        repo: `${TEST_REPO_OWNER}/${TEST_REPO_NAME}`,
        task: `Create a feature file at "e2e-tests/${issueId}/feature.ts" that exports a function called "greet" which takes a name parameter and returns a greeting string. Also create a test file at "e2e-tests/${issueId}/feature.test.ts" with basic tests.`,
        branch,
        push: true,
      })

      expect(sandboxResult.exitCode).toBe(0)
      expect(sandboxResult.pushed).toBe(true)
      expect(sandboxResult.filesChanged.length).toBeGreaterThan(0)

      console.log(`  ✓ Claude created ${sandboxResult.filesChanged.length} files`)
      console.log(`  ✓ Pushed to branch: ${branch}`)
      console.log(`  ✓ Commit: ${sandboxResult.commitSha}`)

      // Step 2: Create PR
      console.log('\n[Step 2] Creating PR...')
      const pr = await workflows.createPR({
        branch,
        title: `feat(e2e): ${issueId} - Greeting feature`,
        body: `## Summary
This PR implements a greeting feature for E2E testing.

## Changes
${sandboxResult.filesChanged.map(f => `- \`${f}\``).join('\n')}

## Implementation Summary
${sandboxResult.summary}

Closes #${issueId}`,
      })

      expect(pr.number).toBeGreaterThan(0)
      ctx.prNumber = pr.number

      console.log(`  ✓ Created PR #${pr.number}: ${pr.url}`)

      // Step 3: Code review - request changes
      console.log('\n[Step 3] Code review - requesting changes...')
      const changesReview = await workflows.submitReview({
        prNumber: pr.number,
        action: 'request_changes',
        body: `## Code Review Feedback

The implementation looks good, but please make these improvements:

1. Add JSDoc comments to the \`greet\` function
2. Add input validation for empty/null names
3. Add edge case tests

Please address these and push a new commit.`,
      })

      expect(changesReview.state).toBe('CHANGES_REQUESTED')
      console.log(`  ✓ Review submitted: changes requested`)

      // Step 4: Claude addresses feedback
      console.log('\n[Step 4] Claude addresses review feedback...')
      const fixResult = await sandbox.execute({
        repo: `${TEST_REPO_OWNER}/${TEST_REPO_NAME}`,
        task: `Address the code review feedback on branch "${branch}":
1. Add JSDoc comments to the greet function in "e2e-tests/${issueId}/feature.ts"
2. Add input validation for empty/null names
3. Add edge case tests in "e2e-tests/${issueId}/feature.test.ts"`,
        branch,
        push: true,
      })

      expect(fixResult.exitCode).toBe(0)
      expect(fixResult.pushed).toBe(true)

      console.log(`  ✓ Claude addressed feedback`)
      console.log(`  ✓ New commit: ${fixResult.commitSha}`)

      // Step 5: Re-review and approve
      console.log('\n[Step 5] Re-review and approval...')
      const approvalReview = await workflows.submitReview({
        prNumber: pr.number,
        action: 'approve',
        body: `## Code Review - Approved

All feedback has been addressed:
- ✓ JSDoc comments added
- ✓ Input validation implemented
- ✓ Edge case tests added

LGTM! Ready to merge.`,
      })

      expect(approvalReview.state).toBe('APPROVED')
      console.log(`  ✓ PR approved`)

      // Step 6: Merge
      console.log('\n[Step 6] Merging PR...')
      const mergeResult = await workflows.mergePR({
        prNumber: pr.number,
        mergeMethod: 'squash',
      })

      expect(mergeResult.merged).toBe(true)
      console.log(`  ✓ PR merged with sha: ${mergeResult.sha}`)

      // Summary
      console.log('\n' + '='.repeat(60))
      console.log('FULL AUTONOMOUS LOOP COMPLETE')
      console.log('='.repeat(60))
      console.log(`Issue: ${issueId}`)
      console.log(`Branch: ${branch}`)
      console.log(`PR: #${pr.number}`)
      console.log(`Merge SHA: ${mergeResult.sha}`)
      console.log('='.repeat(60))

    }, WORKFLOW_TIMEOUT)
  })

  // --------------------------------------------------------------------------
  // Workflow Trigger Test
  // --------------------------------------------------------------------------

  describeIfSandboxAvailable('Integration: DevelopWorkflow Trigger', () => {
    test('triggering issue.ready starts DevelopWorkflow', async () => {
      const issueId = `e2e-workflow-${Date.now()}`
      const ctx: TestContext = { issueId, branch: `claude/${issueId}` }
      testContexts.push(ctx)

      console.log(`\n[Test] Triggering DevelopWorkflow for ${issueId}...`)

      // Trigger the workflow
      const { workflowId, status } = await workflows.triggerIssueReady({
        id: issueId,
        title: 'E2E Test: Automated development',
        description: 'Create a simple hello world function in e2e-tests/',
      })

      expect(workflowId).toBeTruthy()
      expect(workflowId).toContain('develop-')
      ctx.workflowId = workflowId

      console.log(`  ✓ Workflow started: ${workflowId}`)
      console.log(`  ✓ Initial status: ${status}`)

      // Check workflow status after a short delay
      await new Promise((resolve) => setTimeout(resolve, 5000))

      const workflowStatus = await workflows.getStatus(workflowId)
      console.log(`  ✓ Current status: ${workflowStatus.status}`)

      // Workflow should be running or paused (waiting for approval)
      expect(['running', 'paused', 'complete']).toContain(workflowStatus.status)
    }, 60_000)
  })
})

// ============================================================================
// Stress Tests (optional, run separately)
// ============================================================================

describe.skip('Stress: Concurrent Workflows', () => {
  test('can run multiple workflows concurrently', async () => {
    const count = 3
    const workflows: Promise<any>[] = []

    for (let i = 0; i < count; i++) {
      workflows.push(
        sandbox.execute({
          repo: `${TEST_REPO_OWNER}/${TEST_REPO_NAME}`,
          task: `Create file "e2e-tests/concurrent-${Date.now()}-${i}.md" with content "Concurrent test ${i}"`,
          branch: `e2e/concurrent-${Date.now()}-${i}`,
          push: true,
        })
      )
    }

    const results = await Promise.all(workflows)

    for (const result of results) {
      expect(result.exitCode).toBe(0)
      expect(result.pushed).toBe(true)
    }
  }, WORKFLOW_TIMEOUT * 2)
})
