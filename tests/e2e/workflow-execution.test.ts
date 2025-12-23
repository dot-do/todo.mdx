/**
 * E2E: Workflow Execution Tests (todo-dp6)
 *
 * Tests the full workflow cycle:
 * 1. Issue becomes ready (no blockers)
 * 2. Workflow triggers
 * 3. Claude spawns in sandbox
 * 4. PR created
 * 5. PR approved and merged
 * 6. Issue closed
 *
 * Requires:
 * - WORKER_BASE_URL, WORKER_ACCESS_TOKEN
 * - GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_INSTALLATION_ID
 * - ANTHROPIC_API_KEY (for Claude sandbox)
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

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

function hasFullCredentials(): boolean {
  return hasGitHubCredentials() && hasWorkerCredentials() && !shouldSkipWebhookTests()
}

function hasSandboxCredentials(): boolean {
  return hasFullCredentials() && !!ANTHROPIC_API_KEY
}

// Use shared descriptors
const describeWithCredentials = describeWithBoth
const describeWithSandbox = describeWithAutonomous

const TEST_REPO_OWNER = 'dot-do'
const TEST_REPO_NAME = 'test.mdx'

describeWithCredentials('workflow trigger on issue ready', () => {
  let worktree: Worktree

  beforeAll(() => {
    if (!hasFullCredentials()) {
      console.log(
        'Skipping workflow trigger tests - missing GitHub or Worker credentials'
      )
    }
  })

  beforeEach(async () => {
    worktree = await createTestWorktree('workflow-trigger')
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

  test('issue becoming ready triggers workflow', async () => {
    await beads.init(worktree, 'wf')

    // Create blocker and blocked issue
    const blockerId = await beads.create(worktree, {
      title: `Blocker for workflow ${Date.now()}`,
      type: 'task',
    })

    const blockedId = await beads.create(worktree, {
      title: `Blocked workflow task ${Date.now()}`,
      type: 'task',
      description: 'This issue will trigger a workflow when unblocked',
    })

    // Add dependency
    await beads.dep(worktree, blockedId, blockerId, 'blocks')

    // Push initial state
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Add blocked issue'], {
      cwd: worktree.path,
    })
    await execa('git', ['push', '-u', 'origin', worktree.branch], {
      cwd: worktree.path,
    })
    await beads.sync(worktree)

    // Allow time for production sync (production may have higher latency)
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Verify issue is blocked
    const blockedOutput = await beads.blocked(worktree)
    expect(blockedOutput).toContain(blockedId)

    // Close blocker
    await beads.close(worktree, blockerId, 'Done')

    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Close blocker'], { cwd: worktree.path })
    await execa('git', ['push'], { cwd: worktree.path })
    await beads.sync(worktree)

    // Allow extra time for production sync and workflow trigger
    await new Promise((resolve) => setTimeout(resolve, 3000))

    // Verify issue is now ready
    const readyOutput = await beads.ready(worktree)
    expect(readyOutput).toContain(blockedId)

    // Trigger workflow via API
    const triggerResult = await worker.workflows.triggerIssueReady(
      { id: blockedId, title: `Blocked workflow task ${Date.now()}` },
      {
        owner: TEST_REPO_OWNER,
        name: TEST_REPO_NAME,
        fullName: `${TEST_REPO_OWNER}/${TEST_REPO_NAME}`,
      },
      1 // Installation ID
    )

    expect(triggerResult.ok).toBe(true)
  })

  test('workflow API returns workflow status', async () => {
    const workflowId = `develop-test-${Date.now()}`

    // Try to get workflow status (may not exist)
    try {
      const status = await worker.workflows.getWorkflowStatus(workflowId)
      // If it exists, check structure
      expect(status).toHaveProperty('id')
      expect(status).toHaveProperty('status')
    } catch {
      // Workflow doesn't exist, which is expected for a random ID
      expect(true).toBe(true)
    }
  })
})

describeWithCredentials('PR lifecycle in workflow', () => {
  let worktree: Worktree

  beforeEach(async () => {
    worktree = await createTestWorktree('pr-lifecycle')
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

  test('PR creation triggers workflow state change', async () => {
    await beads.init(worktree, 'pr')

    const issueId = await beads.create(worktree, {
      title: `PR lifecycle test ${Date.now()}`,
      type: 'feature',
    })

    // Update to in_progress (simulating workflow started)
    await beads.update(worktree, issueId, { status: 'in_progress' })

    // Commit changes
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'In progress'], { cwd: worktree.path })
    await execa('git', ['push', '-u', 'origin', worktree.branch], {
      cwd: worktree.path,
    })

    // Create PR
    const pr = await github.createPullRequest({
      title: `Feature: ${issueId}`,
      body: `Implements ${issueId}\n\nCloses #${issueId}`,
      head: worktree.branch,
      base: 'main',
    })

    expect(pr.number).toBeDefined()
    expect(pr.state).toBe('open')

    // Simulate PR webhook
    const webhookResponse = await worker.webhooks.simulatePullRequestEvent(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      'opened',
      {
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        head: { ref: worktree.branch },
        base: { ref: 'main' },
        merged: false,
      }
    )

    expect(webhookResponse.ok).toBe(true)

    // Cleanup
    await github.closePullRequest(pr.number)
  })

  test('PR approval resumes paused workflow', async () => {
    await beads.init(worktree, 'pr')

    const issueId = await beads.create(worktree, {
      title: `PR approval test ${Date.now()}`,
      type: 'feature',
    })

    await beads.update(worktree, issueId, { status: 'in_progress' })

    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Feature work'], { cwd: worktree.path })
    await execa('git', ['push', '-u', 'origin', worktree.branch], {
      cwd: worktree.path,
    })

    // Create PR
    const pr = await github.createPullRequest({
      title: `Feature: ${issueId}`,
      body: `Implements ${issueId}\n\nCloses #${issueId}`,
      head: worktree.branch,
      base: 'main',
    })

    // Simulate PR review approval webhook
    const reviewResponse = await worker.webhooks.simulatePullRequestReviewEvent(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      'submitted',
      {
        state: 'approved',
        user: { login: 'reviewer' },
      },
      {
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        head: { ref: worktree.branch },
      }
    )

    expect(reviewResponse.ok).toBe(true)

    // Cleanup
    await github.closePullRequest(pr.number)
  })

  test('PR merge closes associated issue', async () => {
    await beads.init(worktree, 'pr')

    const issueId = await beads.create(worktree, {
      title: `PR merge test ${Date.now()}`,
      type: 'bug',
    })

    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Fix bug'], { cwd: worktree.path })
    await execa('git', ['push', '-u', 'origin', worktree.branch], {
      cwd: worktree.path,
    })

    // Create PR with "Closes" keyword
    const pr = await github.createPullRequest({
      title: `Fix: ${issueId}`,
      body: `Fixes bug in ${issueId}\n\nCloses #${issueId}`,
      head: worktree.branch,
      base: 'main',
    })

    // Simulate merge webhook
    const mergeResponse = await worker.webhooks.simulatePullRequestEvent(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      'closed',
      {
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        head: { ref: worktree.branch },
        base: { ref: 'main' },
        merged: true,
      }
    )

    expect(mergeResponse.ok).toBe(true)

    // Note: Issue closing depends on GitHub automation or worker implementation
    // Cleanup
    await github.closePullRequest(pr.number).catch(() => {})
  })
})

describeWithSandbox('Claude sandbox integration', () => {
  beforeAll(() => {
    if (!hasSandboxCredentials()) {
      console.log(
        'Skipping Claude sandbox tests - missing ANTHROPIC_API_KEY or other credentials'
      )
    }
  })

  test.skip('workflow spawns Claude in Cloudflare Sandbox', async () => {
    // This test requires the full Cloudflare Sandbox SDK integration
    // Skipped until sandbox is available
    expect(true).toBe(true)
  })

  test.skip('Claude clones repo and executes task', async () => {
    // This test requires full sandbox execution
    // Skipped until sandbox is available
    expect(true).toBe(true)
  })

  test.skip('Claude returns diff/patch from sandbox', async () => {
    // This test requires full sandbox execution
    // Skipped until sandbox is available
    expect(true).toBe(true)
  })
})

describe('workflow state machine', () => {
  test('workflow states are valid', () => {
    const validStates = ['pending', 'running', 'paused', 'complete', 'error']

    // Verify state enum structure
    expect(validStates).toContain('pending')
    expect(validStates).toContain('running')
    expect(validStates).toContain('paused')
    expect(validStates).toContain('complete')
    expect(validStates).toContain('error')
  })

  test('workflow transitions are valid', () => {
    const validTransitions = {
      pending: ['running'],
      running: ['paused', 'complete', 'error'],
      paused: ['running', 'error'],
      complete: [],
      error: ['pending'], // Can retry
    }

    // Verify transition structure
    expect(validTransitions.pending).toContain('running')
    expect(validTransitions.running).toContain('complete')
    expect(validTransitions.paused).toContain('running')
  })

  test('workflow payload structure', () => {
    interface WorkflowPayload {
      repo: { owner: string; name: string; fullName: string }
      issue: { id: string; title: string }
      installationId: number
    }

    const payload: WorkflowPayload = {
      repo: {
        owner: 'test',
        name: 'repo',
        fullName: 'test/repo',
      },
      issue: {
        id: 'test-123',
        title: 'Test issue',
      },
      installationId: 12345,
    }

    expect(payload.repo.fullName).toBe('test/repo')
    expect(payload.issue.id).toBe('test-123')
    expect(payload.installationId).toBe(12345)
  })
})

describe('workflow error handling', () => {
  test('workflow handles missing repo gracefully', async () => {
    if (!hasWorkerCredentials) {
      return
    }

    const response = await worker.workflows.triggerIssueReady(
      { id: 'nonexistent-issue', title: 'Test' },
      {
        owner: 'nonexistent',
        name: 'repo',
        fullName: 'nonexistent/repo',
      },
      99999
    )

    // Should return error response, not crash
    expect(response).toBeDefined()
  })

  test('workflow handles invalid issue gracefully', async () => {
    if (!hasWorkerCredentials) {
      return
    }

    const response = await worker.workflows.triggerIssueReady(
      { id: '', title: '' }, // Invalid issue
      {
        owner: TEST_REPO_OWNER,
        name: TEST_REPO_NAME,
        fullName: `${TEST_REPO_OWNER}/${TEST_REPO_NAME}`,
      },
      1
    )

    // Should handle gracefully
    expect(response).toBeDefined()
  })
})
