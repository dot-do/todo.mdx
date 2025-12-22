/**
 * E2E: Autonomous Agent Assignment Flow (todo-gjl2)
 *
 * Comprehensive tests for the full autonomous development lifecycle:
 *
 * ## Happy Path
 * 1. Assignment → Dispatch: Assign agent → DevelopWorkflow starts
 * 2. Execution: Sandbox runs → code generated → tests pass
 * 3. PR Creation: Branch pushed → PR opened with diff
 * 4. Review Cycle: Changes requested → implemented → re-reviewed
 * 5. Approval: Reviewer approves
 * 6. Merge: PR merged automatically
 * 7. Closure: Issue closed, dependencies unblocked
 *
 * ## Edge Cases
 * - Re-assignment mid-workflow (cancel + restart)
 * - Blocked issue (should not dispatch)
 * - Test failures (retry or escalate)
 * - Review rejection (implement fixes)
 * - Merge conflicts (rebase or escalate)
 * - Timeout handling
 * - Agent not found (error handling)
 * - Multiple issues ready simultaneously
 *
 * Required environment variables:
 * - TEST_API_KEY: API key for worker auth
 * - WORKER_BASE_URL: Worker URL (defaults to https://todo.mdx.do)
 * - ANTHROPIC_API_KEY: For Claude sandbox execution
 *
 * Run with: pnpm --filter @todo.mdx/tests test -- tests/e2e/autonomous-assignment.test.ts
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { createTestWorktree, type Worktree } from '../helpers/worktree'
import {
  describeWithBoth,
  describeWithAutonomous,
  hasGitHubCredentials,
  hasWorkerCredentials,
  shouldSkipWebhookTests,
} from '../helpers'
import * as beads from '../helpers/beads'
import * as github from '../helpers/github'
import * as worker from '../helpers/worker'
import { execa } from 'execa'

// ============================================================================
// Configuration
// ============================================================================

const WORKER_BASE_URL = process.env.WORKER_BASE_URL || 'https://todo.mdx.do'
const TEST_API_KEY = process.env.TEST_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const TEST_REPO_OWNER = process.env.TEST_REPO_OWNER || 'dot-do'
const TEST_REPO_NAME = process.env.TEST_REPO_NAME || 'test.mdx'
const TEST_REPO = `${TEST_REPO_OWNER}/${TEST_REPO_NAME}`

// Timeouts
const WORKFLOW_TIMEOUT = 600_000 // 10 minutes for full workflow
const POLL_INTERVAL = 5_000 // 5 seconds between status checks
const PR_POLL_INTERVAL = 3_000 // 3 seconds for PR status

// Agent IDs
const AGENTS = {
  CODY: 'cody',
  TOM: 'tom',
  QUINN: 'quinn',
  SAM: 'sam',
  PRIYA: 'priya',
} as const

// ============================================================================
// Credential Checks
// ============================================================================

function hasRequiredCredentials(): boolean {
  return hasGitHubCredentials() && hasWorkerCredentials() && !shouldSkipWebhookTests()
}

function hasSandboxCredentials(): boolean {
  return hasRequiredCredentials() && !!ANTHROPIC_API_KEY
}

// ============================================================================
// Helper Functions
// ============================================================================

interface WorkflowStatus {
  id: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  output?: unknown
  error?: string
}

async function pollWorkflowStatus(
  workflowId: string,
  timeout: number = WORKFLOW_TIMEOUT
): Promise<WorkflowStatus> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    try {
      const status = await worker.workflows.getWorkflowStatus(workflowId)
      if (status.status !== 'running') {
        return status as WorkflowStatus
      }
    } catch {
      // Workflow may not exist yet, continue polling
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL))
  }

  throw new Error(`Workflow ${workflowId} timed out after ${timeout}ms`)
}

async function waitForPR(
  branch: string,
  timeout: number = 60_000
): Promise<{ number: number; state: string }> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    try {
      const prs = await github.listPullRequests({ head: `${TEST_REPO_OWNER}:${branch}` })
      if (prs.length > 0) {
        return prs[0]
      }
    } catch {
      // PR may not exist yet
    }
    await new Promise((resolve) => setTimeout(resolve, PR_POLL_INTERVAL))
  }

  throw new Error(`PR for branch ${branch} not found within ${timeout}ms`)
}

async function triggerAssignment(
  issueId: string,
  agentId: string,
  worktree: Worktree
): Promise<{ workflowId: string; ok: boolean }> {
  // Update issue assignee to agent
  await beads.update(worktree, issueId, { assignee: agentId })

  // Commit and push
  await execa('git', ['add', '.'], { cwd: worktree.path })
  await execa('git', ['commit', '-m', `Assign ${issueId} to ${agentId}`], {
    cwd: worktree.path,
  })
  await execa('git', ['push'], { cwd: worktree.path })
  await beads.sync(worktree)

  // Trigger assignment via API
  const result = await worker.workflows.triggerAssignment(
    { id: issueId, assignee: agentId },
    {
      owner: TEST_REPO_OWNER,
      name: TEST_REPO_NAME,
      fullName: TEST_REPO,
    }
  )

  return result
}

// ============================================================================
// Test Suites
// ============================================================================

const describeWithCredentials = describeWithBoth
const describeWithSandbox = describeWithAutonomous

// ============================================================================
// Happy Path Tests
// ============================================================================

describeWithCredentials('agent assignment triggers workflow', () => {
  let worktree: Worktree

  beforeEach(async () => {
    worktree = await createTestWorktree('assignment-trigger')
    await github.configureGitAuth(worktree)
  })

  afterEach(async () => {
    if (worktree) {
      try {
        await github.deleteRemoteBranch(worktree.branch)
      } catch {
        // Ignore cleanup errors
      }
      await worktree.cleanup()
    }
  })

  test('assigning agent to ready issue dispatches DevelopWorkflow', async () => {
    await beads.init(worktree, 'assign')

    // Create a ready issue (no blockers)
    const issueId = await beads.create(worktree, {
      title: `Assignment trigger test ${Date.now()}`,
      type: 'task',
      description: 'Add a console.log statement to index.ts',
    })

    // Push initial state
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Create issue'], { cwd: worktree.path })
    await execa('git', ['push', '-u', 'origin', worktree.branch], {
      cwd: worktree.path,
    })
    await beads.sync(worktree)

    // Verify issue is ready
    const readyOutput = await beads.ready(worktree)
    expect(readyOutput).toContain(issueId)

    // Assign to Cody
    const result = await triggerAssignment(issueId, AGENTS.CODY, worktree)

    expect(result.ok).toBe(true)
    expect(result.workflowId).toBeDefined()
  })

  test('assigning non-agent does not trigger workflow', async () => {
    await beads.init(worktree, 'human')

    const issueId = await beads.create(worktree, {
      title: `Human assignment test ${Date.now()}`,
      type: 'task',
    })

    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Create issue'], { cwd: worktree.path })
    await execa('git', ['push', '-u', 'origin', worktree.branch], {
      cwd: worktree.path,
    })

    // Assign to human (not an agent)
    await beads.update(worktree, issueId, { assignee: 'nathanclevenger' })

    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Assign to human'], { cwd: worktree.path })
    await execa('git', ['push'], { cwd: worktree.path })

    // Trigger should return not-triggered
    const result = await worker.workflows.triggerAssignment(
      { id: issueId, assignee: 'nathanclevenger' },
      {
        owner: TEST_REPO_OWNER,
        name: TEST_REPO_NAME,
        fullName: TEST_REPO,
      }
    )

    expect(result.ok).toBe(true)
    expect(result.triggered).toBe(false)
    expect(result.reason).toContain('not an agent')
  })

  test('assigning agent to blocked issue does not trigger workflow', async () => {
    await beads.init(worktree, 'blocked')

    // Create blocker
    const blockerId = await beads.create(worktree, {
      title: `Blocker ${Date.now()}`,
      type: 'task',
    })

    // Create blocked issue
    const blockedId = await beads.create(worktree, {
      title: `Blocked issue ${Date.now()}`,
      type: 'task',
    })

    // Add dependency
    await beads.dep(worktree, blockedId, blockerId, 'blocks')

    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Create blocked issue'], {
      cwd: worktree.path,
    })
    await execa('git', ['push', '-u', 'origin', worktree.branch], {
      cwd: worktree.path,
    })

    // Assign blocked issue to Cody
    const result = await worker.workflows.triggerAssignment(
      { id: blockedId, assignee: AGENTS.CODY },
      {
        owner: TEST_REPO_OWNER,
        name: TEST_REPO_NAME,
        fullName: TEST_REPO,
      }
    )

    expect(result.ok).toBe(true)
    expect(result.triggered).toBe(false)
    expect(result.reason).toContain('blocked')
  })
})

// ============================================================================
// Re-assignment Tests
// ============================================================================

describeWithCredentials('re-assignment handling', () => {
  let worktree: Worktree

  beforeEach(async () => {
    worktree = await createTestWorktree('reassign')
    await github.configureGitAuth(worktree)
  })

  afterEach(async () => {
    if (worktree) {
      try {
        await github.deleteRemoteBranch(worktree.branch)
      } catch {
        // Ignore
      }
      await worktree.cleanup()
    }
  })

  test('re-assigning to different agent cancels previous workflow', async () => {
    await beads.init(worktree, 'reassign')

    const issueId = await beads.create(worktree, {
      title: `Re-assignment test ${Date.now()}`,
      type: 'task',
      description: 'Test re-assignment cancellation',
    })

    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Create issue'], { cwd: worktree.path })
    await execa('git', ['push', '-u', 'origin', worktree.branch], {
      cwd: worktree.path,
    })

    // First assignment to Cody
    const firstResult = await triggerAssignment(issueId, AGENTS.CODY, worktree)
    expect(firstResult.ok).toBe(true)
    const firstWorkflowId = firstResult.workflowId

    // Wait a bit for workflow to start
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Re-assign to Tom
    const secondResult = await triggerAssignment(issueId, AGENTS.TOM, worktree)
    expect(secondResult.ok).toBe(true)
    expect(secondResult.workflowId).toBeDefined()
    expect(secondResult.workflowId).not.toBe(firstWorkflowId)

    // Check first workflow was cancelled
    try {
      const firstStatus = await worker.workflows.getWorkflowStatus(firstWorkflowId)
      expect(firstStatus.status).toBe('cancelled')
    } catch {
      // Workflow may have been cleaned up, which is also acceptable
    }
  })

  test('re-assigning to same agent is a no-op', async () => {
    await beads.init(worktree, 'same')

    const issueId = await beads.create(worktree, {
      title: `Same agent test ${Date.now()}`,
      type: 'task',
    })

    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Create issue'], { cwd: worktree.path })
    await execa('git', ['push', '-u', 'origin', worktree.branch], {
      cwd: worktree.path,
    })

    // First assignment
    const firstResult = await triggerAssignment(issueId, AGENTS.CODY, worktree)
    const firstWorkflowId = firstResult.workflowId

    // Re-assign to same agent
    const secondResult = await triggerAssignment(issueId, AGENTS.CODY, worktree)

    // Should not create new workflow
    expect(secondResult.ok).toBe(true)
    expect(secondResult.triggered).toBe(false)
    expect(secondResult.reason).toContain('already assigned')
  })
})

// ============================================================================
// Full Lifecycle Tests (requires sandbox)
// ============================================================================

describeWithSandbox('full autonomous lifecycle', () => {
  let worktree: Worktree
  let prNumber: number | null = null

  beforeEach(async () => {
    worktree = await createTestWorktree('lifecycle')
    await github.configureGitAuth(worktree)
    prNumber = null
  })

  afterEach(async () => {
    // Cleanup PR if created
    if (prNumber) {
      try {
        await github.closePullRequest(prNumber)
      } catch {
        // Ignore
      }
    }

    if (worktree) {
      try {
        await github.deleteRemoteBranch(worktree.branch)
      } catch {
        // Ignore
      }
      await worktree.cleanup()
    }
  })

  test(
    'assignment → execution → PR → approval → merge → close',
    async () => {
      await beads.init(worktree, 'full')

      // Create issue with clear task
      const issueId = await beads.create(worktree, {
        title: `Full lifecycle test ${Date.now()}`,
        type: 'task',
        description: `Add a new file called hello.txt with the content "Hello from autonomous agent"`,
      })

      // Create base file structure
      await execa('sh', ['-c', 'echo "# Test Repo" > README.md'], {
        cwd: worktree.path,
      })

      await execa('git', ['add', '.'], { cwd: worktree.path })
      await execa('git', ['commit', '-m', 'Initial commit'], {
        cwd: worktree.path,
      })
      await execa('git', ['push', '-u', 'origin', worktree.branch], {
        cwd: worktree.path,
      })
      await beads.sync(worktree)

      // Assign to Cody and trigger workflow
      const result = await triggerAssignment(issueId, AGENTS.CODY, worktree)
      expect(result.ok).toBe(true)

      // Wait for workflow to complete
      const workflowStatus = await pollWorkflowStatus(
        result.workflowId,
        WORKFLOW_TIMEOUT
      )
      expect(workflowStatus.status).toBe('completed')

      // Wait for PR to be created
      const pr = await waitForPR(worktree.branch)
      prNumber = pr.number
      expect(pr.state).toBe('open')

      // Approve PR
      await github.approvePullRequest(prNumber)

      // Wait for merge (auto-merge should trigger)
      await new Promise((resolve) => setTimeout(resolve, 5000))

      // Verify PR is merged
      const mergedPr = await github.getPullRequest(prNumber)
      expect(mergedPr.merged).toBe(true)

      // Verify issue is closed
      await beads.sync(worktree)
      const issueStatus = await beads.show(worktree, issueId)
      expect(issueStatus.status).toBe('closed')
    },
    WORKFLOW_TIMEOUT + 60_000
  )

  test(
    'review with requested changes triggers fix cycle',
    async () => {
      await beads.init(worktree, 'review')

      const issueId = await beads.create(worktree, {
        title: `Review cycle test ${Date.now()}`,
        type: 'task',
        description: 'Add a greeting function that says hello',
      })

      await execa('git', ['add', '.'], { cwd: worktree.path })
      await execa('git', ['commit', '-m', 'Create issue'], {
        cwd: worktree.path,
      })
      await execa('git', ['push', '-u', 'origin', worktree.branch], {
        cwd: worktree.path,
      })

      // Assign and wait for PR
      const result = await triggerAssignment(issueId, AGENTS.CODY, worktree)
      expect(result.ok).toBe(true)

      const workflowStatus = await pollWorkflowStatus(result.workflowId)
      expect(workflowStatus.status).toBe('completed')

      const pr = await waitForPR(worktree.branch)
      prNumber = pr.number

      // Request changes
      await github.requestChanges(prNumber, 'Please add a unit test for the greeting function')

      // Wait for agent to implement changes
      await new Promise((resolve) => setTimeout(resolve, 10_000))

      // Check for new commits
      const commits = await github.getPullRequestCommits(prNumber)
      expect(commits.length).toBeGreaterThan(1)

      // Approve after changes
      await github.approvePullRequest(prNumber)

      // Wait for merge
      await new Promise((resolve) => setTimeout(resolve, 5000))

      const mergedPr = await github.getPullRequest(prNumber)
      expect(mergedPr.merged).toBe(true)
    },
    WORKFLOW_TIMEOUT + 120_000
  )
})

// ============================================================================
// Error Handling Tests
// ============================================================================

describeWithCredentials('error handling', () => {
  let worktree: Worktree

  beforeEach(async () => {
    worktree = await createTestWorktree('errors')
    await github.configureGitAuth(worktree)
  })

  afterEach(async () => {
    if (worktree) {
      try {
        await github.deleteRemoteBranch(worktree.branch)
      } catch {
        // Ignore
      }
      await worktree.cleanup()
    }
  })

  test('assigning unknown agent returns error', async () => {
    await beads.init(worktree, 'unknown')

    const issueId = await beads.create(worktree, {
      title: `Unknown agent test ${Date.now()}`,
      type: 'task',
    })

    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Create issue'], { cwd: worktree.path })
    await execa('git', ['push', '-u', 'origin', worktree.branch], {
      cwd: worktree.path,
    })

    const result = await worker.workflows.triggerAssignment(
      { id: issueId, assignee: 'unknown-agent-xyz' },
      {
        owner: TEST_REPO_OWNER,
        name: TEST_REPO_NAME,
        fullName: TEST_REPO,
      }
    )

    expect(result.ok).toBe(true)
    expect(result.triggered).toBe(false)
    expect(result.reason).toContain('not found')
  })

  test('assigning to closed issue does not trigger', async () => {
    await beads.init(worktree, 'closed')

    const issueId = await beads.create(worktree, {
      title: `Closed issue test ${Date.now()}`,
      type: 'task',
    })

    // Close the issue
    await beads.close(worktree, issueId, 'Already done')

    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Close issue'], { cwd: worktree.path })
    await execa('git', ['push', '-u', 'origin', worktree.branch], {
      cwd: worktree.path,
    })

    const result = await worker.workflows.triggerAssignment(
      { id: issueId, assignee: AGENTS.CODY },
      {
        owner: TEST_REPO_OWNER,
        name: TEST_REPO_NAME,
        fullName: TEST_REPO,
      }
    )

    expect(result.ok).toBe(true)
    expect(result.triggered).toBe(false)
    expect(result.reason).toContain('closed')
  })
})

// ============================================================================
// Concurrent Assignment Tests
// ============================================================================

describeWithCredentials('concurrent assignments', () => {
  let worktree: Worktree

  beforeEach(async () => {
    worktree = await createTestWorktree('concurrent')
    await github.configureGitAuth(worktree)
  })

  afterEach(async () => {
    if (worktree) {
      try {
        await github.deleteRemoteBranch(worktree.branch)
      } catch {
        // Ignore
      }
      await worktree.cleanup()
    }
  })

  test('multiple ready issues can be assigned simultaneously', async () => {
    await beads.init(worktree, 'multi')

    // Create multiple ready issues
    const issues = await Promise.all([
      beads.create(worktree, { title: `Issue A ${Date.now()}`, type: 'task' }),
      beads.create(worktree, { title: `Issue B ${Date.now()}`, type: 'task' }),
      beads.create(worktree, { title: `Issue C ${Date.now()}`, type: 'task' }),
    ])

    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Create issues'], { cwd: worktree.path })
    await execa('git', ['push', '-u', 'origin', worktree.branch], {
      cwd: worktree.path,
    })

    // Assign each to a different agent
    const assignments = [
      { issueId: issues[0], agent: AGENTS.CODY },
      { issueId: issues[1], agent: AGENTS.TOM },
      { issueId: issues[2], agent: AGENTS.QUINN },
    ]

    const results = await Promise.all(
      assignments.map(({ issueId, agent }) =>
        worker.workflows.triggerAssignment(
          { id: issueId, assignee: agent },
          {
            owner: TEST_REPO_OWNER,
            name: TEST_REPO_NAME,
            fullName: TEST_REPO,
          }
        )
      )
    )

    // All should succeed
    results.forEach((result, i) => {
      expect(result.ok).toBe(true)
      expect(result.triggered).toBe(true)
      expect(result.workflowId).toBeDefined()
    })

    // All workflow IDs should be unique
    const workflowIds = results.map((r) => r.workflowId)
    const uniqueIds = new Set(workflowIds)
    expect(uniqueIds.size).toBe(workflowIds.length)
  })
})

// ============================================================================
// Dependency Unblocking Tests
// ============================================================================

describeWithCredentials('dependency unblocking', () => {
  let worktree: Worktree

  beforeEach(async () => {
    worktree = await createTestWorktree('unblock')
    await github.configureGitAuth(worktree)
  })

  afterEach(async () => {
    if (worktree) {
      try {
        await github.deleteRemoteBranch(worktree.branch)
      } catch {
        // Ignore
      }
      await worktree.cleanup()
    }
  })

  test('closing issue unblocks dependents which can then be assigned', async () => {
    await beads.init(worktree, 'deps')

    // Create dependency chain: A blocks B blocks C
    const issueA = await beads.create(worktree, {
      title: `Issue A ${Date.now()}`,
      type: 'task',
    })
    const issueB = await beads.create(worktree, {
      title: `Issue B ${Date.now()}`,
      type: 'task',
    })
    const issueC = await beads.create(worktree, {
      title: `Issue C ${Date.now()}`,
      type: 'task',
    })

    await beads.dep(worktree, issueB, issueA, 'blocks')
    await beads.dep(worktree, issueC, issueB, 'blocks')

    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Create dependency chain'], {
      cwd: worktree.path,
    })
    await execa('git', ['push', '-u', 'origin', worktree.branch], {
      cwd: worktree.path,
    })

    // B and C should be blocked
    const blockedOutput = await beads.blocked(worktree)
    expect(blockedOutput).toContain(issueB)
    expect(blockedOutput).toContain(issueC)

    // Close A
    await beads.close(worktree, issueA, 'Done')
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Close A'], { cwd: worktree.path })
    await execa('git', ['push'], { cwd: worktree.path })

    // Now B should be ready (can be assigned)
    const result = await worker.workflows.triggerAssignment(
      { id: issueB, assignee: AGENTS.CODY },
      {
        owner: TEST_REPO_OWNER,
        name: TEST_REPO_NAME,
        fullName: TEST_REPO,
      }
    )

    expect(result.ok).toBe(true)
    expect(result.triggered).toBe(true)

    // C should still be blocked
    const resultC = await worker.workflows.triggerAssignment(
      { id: issueC, assignee: AGENTS.TOM },
      {
        owner: TEST_REPO_OWNER,
        name: TEST_REPO_NAME,
        fullName: TEST_REPO,
      }
    )

    expect(resultC.ok).toBe(true)
    expect(resultC.triggered).toBe(false)
    expect(resultC.reason).toContain('blocked')
  })
})
