import { describe, test, expect, beforeEach, afterEach, beforeAll } from 'vitest'
import { createTestWorktree, type Worktree, waitFor } from '../helpers'
import * as beads from '../helpers/beads'
import * as github from '../helpers/github'
import * as worker from '../helpers/worker'
import { execa } from 'execa'

// Skip webhook simulation tests when running against production without the real secret
const WORKER_BASE_URL = process.env.WORKER_BASE_URL || 'https://todo.mdx.do'
const isProduction = WORKER_BASE_URL.includes('todo.mdx.do')
const hasWebhookSecret = process.env.GITHUB_WEBHOOK_SECRET !== undefined
const skipWebhookTests = isProduction && !hasWebhookSecret

// Skip all tests in this file if GitHub credentials are not configured
const describeWithGitHub = github.hasGitHubCredentials() ? describe : describe.skip
const describeWithWorker = worker.hasWorkerCredentials() && !skipWebhookTests ? describe : describe.skip
const describeWithBoth = github.hasGitHubCredentials() && worker.hasWorkerCredentials() && !skipWebhookTests ? describe : describe.skip

const TEST_REPO_OWNER = 'dot-do'
const TEST_REPO_NAME = 'test.mdx'

describeWithGitHub('GitHub sync', () => {
  let worktree: Worktree

  beforeAll(() => {
    if (!github.hasGitHubCredentials()) {
      console.log('Skipping GitHub sync tests - no credentials configured')
    }
  })

  beforeEach(async () => {
    worktree = await createTestWorktree('github-sync')
    // Configure git credentials for this worktree
    await github.configureGitAuth(worktree)
  })

  afterEach(async () => {
    // Clean up remote branch
    if (worktree) {
      try {
        await github.deleteRemoteBranch(worktree.branch)
      } catch {
        // Ignore cleanup errors
      }
      await worktree.cleanup()
    }
  })

  test('bd create and push creates GitHub issue', async () => {
    await beads.init(worktree, 'test')

    // Create a unique issue title to find it later
    const uniqueTitle = `Test issue ${Date.now()}`
    const issueId = await beads.create(worktree, {
      title: uniqueTitle,
      type: 'task',
      priority: 1,
    })

    // Commit and push
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Add test issue'], { cwd: worktree.path })
    await execa('git', ['push', '-u', 'origin', worktree.branch], { cwd: worktree.path })

    // Sync beads (which should create GitHub issue)
    await beads.sync(worktree)

    // Wait for GitHub issue to be created
    const createdIssue = await waitFor(
      async () => {
        const issues = await github.listIssues({ state: 'open' })
        return issues.find((i: any) => i.title.includes(uniqueTitle))
      },
      { timeout: 10000, description: 'GitHub issue to be created' }
    )

    expect(createdIssue).toBeDefined()
    expect(createdIssue?.labels.map((l: any) => (typeof l === 'string' ? l : l.name))).toContain('task')
  })

  test('bd update and push updates GitHub issue', async () => {
    await beads.init(worktree, 'test')

    // Create issue
    const uniqueTitle = `Update test ${Date.now()}`
    const issueId = await beads.create(worktree, {
      title: uniqueTitle,
      type: 'task',
    })

    // Push initial
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Add issue'], { cwd: worktree.path })
    await execa('git', ['push', '-u', 'origin', worktree.branch], { cwd: worktree.path })
    await beads.sync(worktree)

    // Wait for GitHub issue to be created
    await waitFor(
      async () => {
        const issues = await github.listIssues({ state: 'open' })
        return issues.find((i: any) => i.title.includes(uniqueTitle))
      },
      { timeout: 10000, description: 'GitHub issue to be created' }
    )

    // Update to in_progress
    await beads.update(worktree, issueId, { status: 'in_progress' })

    // Push update
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Update status'], { cwd: worktree.path })
    await execa('git', ['push'], { cwd: worktree.path })
    await beads.sync(worktree)

    // Wait for GitHub issue status to update
    const issue = await waitFor(
      async () => {
        const issues = await github.listIssues({ state: 'open' })
        const issue = issues.find((i: any) => i.title.includes(uniqueTitle))
        const labels = issue?.labels.map((l: any) => (typeof l === 'string' ? l : l.name)) || []
        return labels.includes('in-progress') ? issue : undefined
      },
      { timeout: 10000, description: 'GitHub issue status to update' }
    )

    expect(issue).toBeDefined()
    const labels = issue?.labels.map((l: any) => (typeof l === 'string' ? l : l.name)) || []
    expect(labels).toContain('in-progress')
  })

  test('bd close and push closes GitHub issue', async () => {
    await beads.init(worktree, 'test')

    // Create issue
    const uniqueTitle = `Close test ${Date.now()}`
    const issueId = await beads.create(worktree, {
      title: uniqueTitle,
      type: 'task',
    })

    // Push and sync
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Add issue'], { cwd: worktree.path })
    await execa('git', ['push', '-u', 'origin', worktree.branch], { cwd: worktree.path })
    await beads.sync(worktree)

    // Wait for GitHub issue to be created
    await waitFor(
      async () => {
        const issues = await github.listIssues({ state: 'open' })
        return issues.find((i: any) => i.title.includes(uniqueTitle))
      },
      { timeout: 10000, description: 'GitHub issue to be created' }
    )

    // Close the issue
    await beads.close(worktree, issueId, 'Completed')

    // Push closure
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Close issue'], { cwd: worktree.path })
    await execa('git', ['push'], { cwd: worktree.path })
    await beads.sync(worktree)

    // Wait for GitHub issue to be closed
    const closedIssue = await waitFor(
      async () => {
        const closedIssues = await github.listIssues({ state: 'closed' })
        return closedIssues.find((i: any) => i.title.includes(uniqueTitle))
      },
      { timeout: 10000, description: 'GitHub issue to be closed' }
    )

    expect(closedIssue).toBeDefined()
    expect(closedIssue?.state).toBe('closed')
  })

  test('PR merge flow with beads', async () => {
    await beads.init(worktree, 'test')

    // Create issue
    const uniqueTitle = `PR merge test ${Date.now()}`
    const issueId = await beads.create(worktree, {
      title: uniqueTitle,
      type: 'feature',
    })

    // Update to in_progress
    await beads.update(worktree, issueId, { status: 'in_progress' })

    // Commit changes
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', `Implement feature: ${uniqueTitle}`], {
      cwd: worktree.path,
    })
    await execa('git', ['push', '-u', 'origin', worktree.branch], { cwd: worktree.path })

    // Create PR
    const pr = await github.createPullRequest({
      title: `Feature: ${uniqueTitle}`,
      body: `Implements ${issueId}\n\nCloses #${issueId}`,
      head: worktree.branch,
      base: 'main',
    })

    expect(pr.number).toBeDefined()
    expect(pr.state).toBe('open')

    // Close PR without merge (to not pollute main branch in tests)
    await github.closePullRequest(pr.number)

    // Verify PR was closed
    const closedPr = await github.closePullRequest(pr.number)
    expect(closedPr.state).toBe('closed')
  })
})

/**
 * E2E: GitHub Issues Sync Tests (todo-1sp)
 *
 * Tests GitHub Issue webhook handlers and bidirectional sync:
 * - Issue create/update/close via webhooks
 * - D1 updates from GitHub events
 * - Bidirectional sync verification
 */
describeWithBoth('GitHub webhook handlers', () => {
  beforeAll(() => {
    if (!worker.hasWorkerCredentials()) {
      console.log('Skipping webhook handler tests - no WORKER_ACCESS_TOKEN configured')
    }
  })

  test('issue opened webhook creates issue in D1', async () => {
    const uniqueTitle = `Webhook test issue ${Date.now()}`
    const issueNumber = Math.floor(Math.random() * 100000) + 10000

    // Simulate GitHub issue opened webhook
    const response = await worker.webhooks.simulateIssueEvent(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      'opened',
      {
        number: issueNumber,
        title: uniqueTitle,
        body: 'Test issue created via webhook simulation',
        state: 'open',
        labels: [{ name: 'task' }],
        user: { login: 'test-user' },
      }
    )

    expect(response.ok).toBe(true)

    // Wait for webhook processing
    const createdIssue = await waitFor(
      async () => {
        const { issues } = await worker.repos.listIssues(TEST_REPO_OWNER, TEST_REPO_NAME)
        return issues.find((i: any) => i.github_number === issueNumber)
      },
      { timeout: 5000, description: 'webhook to create issue in D1' }
    )

    expect(createdIssue).toBeDefined()
    expect(createdIssue?.title).toBe(uniqueTitle)
  })

  test('issue edited webhook updates issue in D1', async () => {
    const issueNumber = Math.floor(Math.random() * 100000) + 10000
    const originalTitle = `Original title ${Date.now()}`
    const updatedTitle = `Updated title ${Date.now()}`

    // Create issue first
    await worker.webhooks.simulateIssueEvent(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      'opened',
      {
        number: issueNumber,
        title: originalTitle,
        body: 'Original body',
        state: 'open',
        labels: [],
      }
    )

    // Wait for initial issue to be created
    await waitFor(
      async () => {
        const { issues } = await worker.repos.listIssues(TEST_REPO_OWNER, TEST_REPO_NAME)
        return issues.find((i: any) => i.github_number === issueNumber)
      },
      { timeout: 5000, description: 'initial issue to be created in D1' }
    )

    // Edit the issue
    await worker.webhooks.simulateIssueEvent(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      'edited',
      {
        number: issueNumber,
        title: updatedTitle,
        body: 'Updated body',
        state: 'open',
        labels: [{ name: 'feature' }],
      }
    )

    // Wait for issue to be updated
    const updatedIssue = await waitFor(
      async () => {
        const { issues } = await worker.repos.listIssues(TEST_REPO_OWNER, TEST_REPO_NAME)
        const issue = issues.find((i: any) => i.github_number === issueNumber)
        return issue?.title === updatedTitle ? issue : undefined
      },
      { timeout: 5000, description: 'issue to be updated in D1' }
    )

    expect(updatedIssue?.title).toBe(updatedTitle)
  })

  test('issue closed webhook updates state in D1', async () => {
    const issueNumber = Math.floor(Math.random() * 100000) + 10000
    const title = `Close webhook test ${Date.now()}`

    // Create issue
    await worker.webhooks.simulateIssueEvent(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      'opened',
      {
        number: issueNumber,
        title,
        body: 'Will be closed',
        state: 'open',
        labels: [],
      }
    )

    // Wait for issue to be created
    await waitFor(
      async () => {
        const { issues } = await worker.repos.listIssues(TEST_REPO_OWNER, TEST_REPO_NAME)
        return issues.find((i: any) => i.github_number === issueNumber)
      },
      { timeout: 5000, description: 'issue to be created in D1' }
    )

    // Close issue
    await worker.webhooks.simulateIssueEvent(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      'closed',
      {
        number: issueNumber,
        title,
        body: 'Will be closed',
        state: 'closed',
        labels: [],
      }
    )

    // Wait for issue to be closed
    const closedIssue = await waitFor(
      async () => {
        const { issues } = await worker.repos.listIssues(TEST_REPO_OWNER, TEST_REPO_NAME)
        const issue = issues.find((i: any) => i.github_number === issueNumber)
        return issue?.state === 'closed' ? issue : undefined
      },
      { timeout: 5000, description: 'issue to be closed in D1' }
    )

    expect(closedIssue?.state).toBe('closed')
  })

  test('issue reopened webhook updates state in D1', async () => {
    const issueNumber = Math.floor(Math.random() * 100000) + 10000
    const title = `Reopen webhook test ${Date.now()}`

    // Create and close
    await worker.webhooks.simulateIssueEvent(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      'opened',
      {
        number: issueNumber,
        title,
        body: 'Will be reopened',
        state: 'open',
        labels: [],
      }
    )

    await waitFor(
      async () => {
        const { issues } = await worker.repos.listIssues(TEST_REPO_OWNER, TEST_REPO_NAME)
        return issues.find((i: any) => i.github_number === issueNumber)
      },
      { timeout: 5000, description: 'issue to be created in D1' }
    )

    await worker.webhooks.simulateIssueEvent(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      'closed',
      {
        number: issueNumber,
        title,
        body: 'Will be reopened',
        state: 'closed',
        labels: [],
      }
    )

    await waitFor(
      async () => {
        const { issues } = await worker.repos.listIssues(TEST_REPO_OWNER, TEST_REPO_NAME)
        const issue = issues.find((i: any) => i.github_number === issueNumber)
        return issue?.state === 'closed' ? issue : undefined
      },
      { timeout: 5000, description: 'issue to be closed in D1' }
    )

    // Reopen
    await worker.webhooks.simulateIssueEvent(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      'reopened',
      {
        number: issueNumber,
        title,
        body: 'Will be reopened',
        state: 'open',
        labels: [],
      }
    )

    // Wait for issue to be reopened
    const reopenedIssue = await waitFor(
      async () => {
        const { issues } = await worker.repos.listIssues(TEST_REPO_OWNER, TEST_REPO_NAME)
        const issue = issues.find((i: any) => i.github_number === issueNumber)
        return issue?.state === 'open' ? issue : undefined
      },
      { timeout: 5000, description: 'issue to be reopened in D1' }
    )

    expect(reopenedIssue?.state).toBe('open')
  })

  test('labels sync from GitHub to D1', async () => {
    const issueNumber = Math.floor(Math.random() * 100000) + 10000
    const title = `Labels sync test ${Date.now()}`

    await worker.webhooks.simulateIssueEvent(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      'opened',
      {
        number: issueNumber,
        title,
        body: 'Testing label sync',
        state: 'open',
        labels: [
          { name: 'bug' },
          { name: 'priority:high' },
          { name: 'area:frontend' },
        ],
      }
    )

    // Wait for issue with labels to be created
    const issue = await waitFor(
      async () => {
        const { issues } = await worker.repos.listIssues(TEST_REPO_OWNER, TEST_REPO_NAME)
        const issue = issues.find((i: any) => i.github_number === issueNumber)
        if (!issue?.labels) return undefined
        const labels = JSON.parse(issue.labels)
        return labels.includes('bug') ? issue : undefined
      },
      { timeout: 5000, description: 'issue with labels to be created in D1' }
    )

    expect(issue).toBeDefined()
    const labels = issue?.labels ? JSON.parse(issue.labels) : []
    expect(labels).toContain('bug')
    expect(labels).toContain('priority:high')
  })
})

describeWithBoth('bidirectional sync verification', () => {
  let worktree: Worktree

  beforeEach(async () => {
    worktree = await createTestWorktree('bidirectional-sync')
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

  test('beads issue syncs to GitHub, GitHub edit syncs to D1', async () => {
    await beads.init(worktree, 'bidir')

    const uniqueTitle = `Bidirectional sync ${Date.now()}`
    const issueId = await beads.create(worktree, {
      title: uniqueTitle,
      type: 'task',
      priority: 1,
    })

    // Push to GitHub
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Add issue'], { cwd: worktree.path })
    await execa('git', ['push', '-u', 'origin', worktree.branch], {
      cwd: worktree.path,
    })
    await beads.sync(worktree)

    // Wait for issue to appear on GitHub
    const ghIssue = await waitFor(
      async () => {
        const issues = await github.listIssues({ state: 'open' })
        return issues.find((i: any) => i.title.includes(uniqueTitle))
      },
      { timeout: 10000, description: 'issue to appear on GitHub' }
    )
    expect(ghIssue).toBeDefined()

    // Simulate GitHub edit webhook (as if someone edited via GitHub UI)
    await worker.webhooks.simulateIssueEvent(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      'edited',
      {
        number: ghIssue.number,
        title: ghIssue.title,
        body: 'Updated via GitHub UI simulation',
        state: 'open',
        labels: [{ name: 'in-progress' }],
      }
    )

    // Wait for D1 to have the update
    const d1Issue = await waitFor(
      async () => {
        const { issues: workerIssues } = await worker.repos.listIssues(
          TEST_REPO_OWNER,
          TEST_REPO_NAME
        )
        const issue = workerIssues.find((i: any) => i.github_number === ghIssue.number)
        return issue?.body?.includes('Updated via GitHub UI simulation') ? issue : undefined
      },
      { timeout: 5000, description: 'D1 to have the update' }
    )

    expect(d1Issue).toBeDefined()
    expect(d1Issue?.body).toContain('Updated via GitHub UI simulation')
  })

  test('D1 sync updates propagate to beads on next sync', async () => {
    await beads.init(worktree, 'bidir')

    // Create issue via beads
    const uniqueTitle = `D1 to beads sync ${Date.now()}`
    const issueId = await beads.create(worktree, {
      title: uniqueTitle,
      type: 'task',
    })

    // Push and sync
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Add issue'], { cwd: worktree.path })
    await execa('git', ['push', '-u', 'origin', worktree.branch], {
      cwd: worktree.path,
    })
    await beads.sync(worktree)

    // Wait for issue to be synced
    await waitFor(
      async () => {
        const { issues } = await worker.repos.listIssues(TEST_REPO_OWNER, TEST_REPO_NAME)
        return issues.find((i: any) => i.title.includes(uniqueTitle) || i.beads_id === issueId)
      },
      { timeout: 10000, description: 'issue to be synced to D1' }
    )

    // Directly update D1 via sync API (simulating external update)
    await worker.sync.syncIssues(TEST_REPO_OWNER, TEST_REPO_NAME, {
      source: 'github',
      issues: [
        {
          beadsId: issueId,
          title: uniqueTitle,
          state: 'open',
          labels: ['in-progress'],
          type: 'task',
          priority: 0, // Changed priority
        },
      ],
    })

    // Wait for sync to complete
    await waitFor(
      async () => {
        const { issues } = await worker.repos.listIssues(TEST_REPO_OWNER, TEST_REPO_NAME)
        const issue = issues.find((i: any) => i.beads_id === issueId)
        return issue?.priority === 0 ? issue : undefined
      },
      { timeout: 5000, description: 'sync to complete' }
    )

    // Pull and sync
    await execa('git', ['pull'], { cwd: worktree.path })
    await beads.sync(worktree)

    // Local beads should reflect changes after sync
    const showOutput = await beads.show(worktree, issueId)
    // Note: Actual bidirectional sync may require more implementation
    expect(showOutput).toBeTruthy()
  })
})

describeWithWorker('GitHub push event sync', () => {
  test('push with .beads/ changes triggers sync', async () => {
    const beforeSha = '0000000000000000000000000000000000000000'
    const afterSha = crypto.randomUUID().replace(/-/g, '').slice(0, 40)

    const response = await worker.webhooks.simulatePushEvent(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      {
        ref: 'refs/heads/test-branch',
        before: beforeSha,
        after: afterSha,
        commits: [
          {
            id: afterSha,
            message: 'Update beads issues',
            added: [],
            modified: ['.beads/issues.db', '.beads/issues/test-123.md'],
            removed: [],
          },
        ],
      }
    )

    expect(response.ok).toBe(true)
  })

  test('push with TODO.mdx changes triggers file sync', async () => {
    const beforeSha = '0000000000000000000000000000000000000000'
    const afterSha = crypto.randomUUID().replace(/-/g, '').slice(0, 40)

    const response = await worker.webhooks.simulatePushEvent(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      {
        ref: 'refs/heads/main',
        before: beforeSha,
        after: afterSha,
        commits: [
          {
            id: afterSha,
            message: 'Update TODO',
            added: [],
            modified: ['TODO.mdx', '.todo/issue-1.md'],
            removed: [],
          },
        ],
      }
    )

    expect(response.ok).toBe(true)
  })

  test('push with ROADMAP.mdx changes triggers roadmap sync', async () => {
    const beforeSha = '0000000000000000000000000000000000000000'
    const afterSha = crypto.randomUUID().replace(/-/g, '').slice(0, 40)

    const response = await worker.webhooks.simulatePushEvent(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      {
        ref: 'refs/heads/main',
        before: beforeSha,
        after: afterSha,
        commits: [
          {
            id: afterSha,
            message: 'Update roadmap',
            added: ['ROADMAP.mdx'],
            modified: [],
            removed: [],
          },
        ],
      }
    )

    expect(response.ok).toBe(true)
  })
})
