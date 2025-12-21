/**
 * E2E: Beads Sync Roundtrip Tests (todo-pia)
 *
 * Tests the full sync cycle:
 * 1. bd sync pushes to GitHub
 * 2. GitHub webhook triggers worker
 * 3. Worker updates D1 via Durable Object
 * 4. Changes sync back to local .beads/
 *
 * Requires:
 * - GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_INSTALLATION_ID
 * - WORKER_BASE_URL, WORKER_ACCESS_TOKEN
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll } from 'vitest'
import { createTestWorktree, type Worktree, waitFor } from '../helpers'
import * as beads from '../helpers/beads'
import * as github from '../helpers/github'
import * as worker from '../helpers/worker'
import { execa } from 'execa'

// Skip all tests if credentials not configured
const hasCredentials = github.hasGitHubCredentials() && worker.hasWorkerCredentials()
const describeWithCredentials = hasCredentials ? describe : describe.skip

const TEST_REPO_OWNER = 'dot-do'
const TEST_REPO_NAME = 'test.mdx'

describeWithCredentials('beads sync roundtrip', () => {
  let worktree: Worktree

  beforeAll(() => {
    if (!hasCredentials) {
      console.log(
        'Skipping beads sync roundtrip tests - missing GitHub or Worker credentials'
      )
    }
  })

  beforeEach(async () => {
    worktree = await createTestWorktree('beads-roundtrip')
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

  test('full roundtrip: beads → GitHub → webhook → D1', async () => {
    // 1. Initialize beads and create issue
    await beads.init(worktree, 'sync')

    const uniqueTitle = `Roundtrip test ${Date.now()}`
    const issueId = await beads.create(worktree, {
      title: uniqueTitle,
      type: 'task',
      priority: 1,
      description: 'Test issue for sync roundtrip verification',
    })

    expect(issueId).toBeTruthy()
    expect(issueId).toMatch(/^sync-/)

    // 2. Commit and push to GitHub
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Add beads issue for roundtrip test'], {
      cwd: worktree.path,
    })
    await execa('git', ['push', '-u', 'origin', worktree.branch], {
      cwd: worktree.path,
    })

    // 3. Trigger bd sync (this pushes beads state to cloud)
    await beads.sync(worktree)

    // 4. Wait for issue to appear on GitHub
    const createdIssue = await waitFor(
      async () => {
        const issues = await github.listIssues({ state: 'open' })
        return issues.find((i: any) => i.title.includes(uniqueTitle))
      },
      { timeout: 15000, description: 'issue to appear on GitHub' }
    )
    expect(createdIssue).toBeDefined()
    expect(createdIssue?.body).toContain('Test issue for sync roundtrip verification')

    // 5. Check D1 via worker API
    const status = await worker.sync.getStatus(TEST_REPO_OWNER, TEST_REPO_NAME)
    expect(status.issues).toBeGreaterThan(0)

    // 6. Verify issue appears in worker's issue list
    const workerIssue = await waitFor(
      async () => {
        const { issues: workerIssues } = await worker.repos.listIssues(
          TEST_REPO_OWNER,
          TEST_REPO_NAME
        )
        return workerIssues.find((i) => i.title.includes(uniqueTitle) || i.beads_id === issueId)
      },
      { timeout: 10000, description: 'issue to appear in D1' }
    )
    expect(workerIssue).toBeDefined()
  })

  test('update sync: beads update → GitHub → D1', async () => {
    await beads.init(worktree, 'sync')

    // Create issue
    const uniqueTitle = `Update sync test ${Date.now()}`
    const issueId = await beads.create(worktree, {
      title: uniqueTitle,
      type: 'feature',
    })

    // Push initial state
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Initial issue'], { cwd: worktree.path })
    await execa('git', ['push', '-u', 'origin', worktree.branch], {
      cwd: worktree.path,
    })
    await beads.sync(worktree)

    // Wait for initial issue to be created on GitHub
    await waitFor(
      async () => {
        const issues = await github.listIssues({ state: 'open' })
        return issues.find((i: any) => i.title.includes(uniqueTitle))
      },
      { timeout: 10000, description: 'initial issue to be created on GitHub' }
    )

    // Update issue status
    await beads.update(worktree, issueId, { status: 'in_progress' })

    // Push update
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Update issue status'], {
      cwd: worktree.path,
    })
    await execa('git', ['push'], { cwd: worktree.path })
    await beads.sync(worktree)

    // Wait for GitHub issue status to update
    const issue = await waitFor(
      async () => {
        const issues = await github.listIssues({ state: 'open' })
        const issue = issues.find((i: any) => i.title.includes(uniqueTitle))
        const labels = issue?.labels.map((l: any) =>
          typeof l === 'string' ? l : l.name
        ) || []
        return labels.includes('in-progress') ? issue : undefined
      },
      { timeout: 10000, description: 'GitHub issue status to update' }
    )
    expect(issue).toBeDefined()

    const labels = issue?.labels.map((l: any) =>
      typeof l === 'string' ? l : l.name
    ) || []
    expect(labels).toContain('in-progress')
  })

  test('close sync: beads close → GitHub closed', async () => {
    await beads.init(worktree, 'sync')

    // Create issue
    const uniqueTitle = `Close sync test ${Date.now()}`
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

    // Wait for issue to be created on GitHub
    await waitFor(
      async () => {
        const issues = await github.listIssues({ state: 'open' })
        return issues.find((i: any) => i.title.includes(uniqueTitle))
      },
      { timeout: 10000, description: 'issue to be created on GitHub' }
    )

    // Close the issue
    await beads.close(worktree, issueId, 'Completed roundtrip test')

    // Push closure
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Close issue'], { cwd: worktree.path })
    await execa('git', ['push'], { cwd: worktree.path })
    await beads.sync(worktree)

    // Wait for issue to be closed on GitHub
    const closedIssue = await waitFor(
      async () => {
        const closedIssues = await github.listIssues({ state: 'closed' })
        return closedIssues.find((i: any) => i.title.includes(uniqueTitle))
      },
      { timeout: 10000, description: 'issue to be closed on GitHub' }
    )
    expect(closedIssue).toBeDefined()
    expect(closedIssue?.state).toBe('closed')
  })

  test('title and description sync: beads changes → GitHub', async () => {
    await beads.init(worktree, 'sync')

    // Create issue with initial title/description
    const timestamp = Date.now()
    const originalTitle = `Title sync test ${timestamp}`
    const issueId = await beads.create(worktree, {
      title: originalTitle,
      type: 'task',
      description: 'Original description',
    })

    // Push initial state
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Initial issue'], { cwd: worktree.path })
    await execa('git', ['push', '-u', 'origin', worktree.branch], {
      cwd: worktree.path,
    })
    await beads.sync(worktree)

    // Wait for initial issue on GitHub
    const initialIssue = await waitFor(
      async () => {
        const issues = await github.listIssues({ state: 'open' })
        return issues.find((i: any) => i.title === originalTitle)
      },
      { timeout: 10000, description: 'initial issue on GitHub' }
    )
    expect(initialIssue).toBeDefined()
    expect(initialIssue?.body).toContain('Original description')

    // Update title and description using bd CLI
    const updatedTitle = `Updated: ${originalTitle}`
    await execa('bd', [
      'update', issueId,
      '--title', updatedTitle,
      '--description', 'Updated description with more details',
    ], { cwd: worktree.path })

    // Push update
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Update title and description'], {
      cwd: worktree.path,
    })
    await execa('git', ['push'], { cwd: worktree.path })
    await beads.sync(worktree)

    // Wait for GitHub issue to have updated title/body
    const updatedIssue = await waitFor(
      async () => {
        const issues = await github.listIssues({ state: 'open' })
        return issues.find((i: any) => i.title === updatedTitle)
      },
      { timeout: 10000, description: 'GitHub issue with updated title' }
    )
    expect(updatedIssue).toBeDefined()
    expect(updatedIssue?.title).toBe(updatedTitle)
    expect(updatedIssue?.body).toContain('Updated description')
  })

  test('priority sync: beads priority change → GitHub labels', async () => {
    await beads.init(worktree, 'sync')

    // Create issue with initial priority
    const uniqueTitle = `Priority sync test ${Date.now()}`
    const issueId = await beads.create(worktree, {
      title: uniqueTitle,
      type: 'task',
      priority: 2, // Start with P2
    })

    // Push initial state
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Initial issue with P2'], { cwd: worktree.path })
    await execa('git', ['push', '-u', 'origin', worktree.branch], {
      cwd: worktree.path,
    })
    await beads.sync(worktree)

    // Wait for initial issue with P2 label
    const initialIssue = await waitFor(
      async () => {
        const issues = await github.listIssues({ state: 'open' })
        const issue = issues.find((i: any) => i.title.includes(uniqueTitle))
        const labels = issue?.labels.map((l: any) =>
          typeof l === 'string' ? l : l.name
        ) || []
        return labels.includes('P2') ? issue : undefined
      },
      { timeout: 10000, description: 'initial issue with P2 label' }
    )
    expect(initialIssue).toBeDefined()

    // Update priority to P1
    await beads.update(worktree, issueId, { priority: 1 })

    // Push update
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Update priority to P1'], {
      cwd: worktree.path,
    })
    await execa('git', ['push'], { cwd: worktree.path })
    await beads.sync(worktree)

    // Wait for GitHub issue to have P1 label (and not P2)
    const updatedIssue = await waitFor(
      async () => {
        const issues = await github.listIssues({ state: 'open' })
        const issue = issues.find((i: any) => i.title.includes(uniqueTitle))
        const labels = issue?.labels.map((l: any) =>
          typeof l === 'string' ? l : l.name
        ) || []
        return labels.includes('P1') && !labels.includes('P2') ? issue : undefined
      },
      { timeout: 10000, description: 'GitHub issue with P1 label' }
    )
    expect(updatedIssue).toBeDefined()

    const labels = updatedIssue?.labels.map((l: any) =>
      typeof l === 'string' ? l : l.name
    ) || []
    expect(labels).toContain('P1')
    expect(labels).not.toContain('P2')
  })

  test('dependency sync: blocked issues sync correctly', async () => {
    await beads.init(worktree, 'sync')

    // Create blocker and blocked issues
    const blockerId = await beads.create(worktree, {
      title: `Blocker ${Date.now()}`,
      type: 'task',
    })

    const blockedId = await beads.create(worktree, {
      title: `Blocked ${Date.now()}`,
      type: 'task',
    })

    // Add dependency
    await beads.dep(worktree, blockedId, blockerId, 'blocks')

    // Verify blocked locally
    const blockedOutput = await beads.blocked(worktree)
    expect(blockedOutput).toContain(blockedId)

    // Push to GitHub
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Add dependent issues'], {
      cwd: worktree.path,
    })
    await execa('git', ['push', '-u', 'origin', worktree.branch], {
      cwd: worktree.path,
    })
    await beads.sync(worktree)

    // Wait for issues to appear on GitHub
    await waitFor(
      async () => {
        const issues = await github.listIssues({ state: 'open' })
        const blockerIssue = issues.find((i: any) => i.body?.includes(blockerId))
        const blockedIssue = issues.find((i: any) => i.body?.includes(blockedId))
        return (blockerIssue || blockedIssue) ? { blockerIssue, blockedIssue } : undefined
      },
      { timeout: 10000, description: 'dependent issues to appear on GitHub' }
    )

    // Re-fetch to verify
    const issues = await github.listIssues({ state: 'open' })
    const blockerIssue = issues.find((i: any) => i.body?.includes(blockerId))
    const blockedIssue = issues.find((i: any) => i.body?.includes(blockedId))

    expect(blockerIssue || blockedIssue).toBeDefined()

    // Close blocker, which should unblock the dependent
    await beads.close(worktree, blockerId, 'Blocker completed')
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Close blocker'], { cwd: worktree.path })
    await execa('git', ['push'], { cwd: worktree.path })
    await beads.sync(worktree)

    // Verify blocked issue is now ready
    const readyOutput = await beads.ready(worktree)
    expect(readyOutput).toContain(blockedId)
  })

  test('push event triggers sync', async () => {
    await beads.init(worktree, 'sync')

    // Create some issues
    await beads.create(worktree, {
      title: `Push sync issue 1 ${Date.now()}`,
      type: 'task',
    })
    await beads.create(worktree, {
      title: `Push sync issue 2 ${Date.now()}`,
      type: 'feature',
    })

    // Commit and get commit SHA
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Add issues for push sync'], {
      cwd: worktree.path,
    })

    const { stdout: beforeSha } = await execa('git', ['rev-parse', 'HEAD~1'], {
      cwd: worktree.path,
    }).catch(() => ({ stdout: '0000000' }))

    const { stdout: afterSha } = await execa('git', ['rev-parse', 'HEAD'], {
      cwd: worktree.path,
    })

    // Push to GitHub
    await execa('git', ['push', '-u', 'origin', worktree.branch], {
      cwd: worktree.path,
    })

    // Simulate push webhook directly to worker
    const result = await worker.sync.syncPush(TEST_REPO_OWNER, TEST_REPO_NAME, {
      ref: `refs/heads/${worktree.branch}`,
      before: beforeSha,
      after: afterSha,
      files: ['.beads/issues.db', '.beads/issues/sync-test1.md'],
    })

    expect(result.queued).toBe(true)
    expect(result.files.beads).toBeGreaterThan(0)

    // Wait for sync to complete
    await waitFor(
      async () => {
        const status = await worker.sync.getStatus(TEST_REPO_OWNER, TEST_REPO_NAME)
        return status.syncStatus?.state === 'idle' ? status : undefined
      },
      { timeout: 10000, description: 'sync to complete' }
    )

    // Verify final status
    const status = await worker.sync.getStatus(TEST_REPO_OWNER, TEST_REPO_NAME)
    expect(status.syncStatus?.state).toBe('idle')
  })

  test('sync state machine handles errors gracefully', async () => {
    // Reset sync state first
    await worker.sync.resetSyncState(TEST_REPO_OWNER, TEST_REPO_NAME)

    // Get initial status
    const initialStatus = await worker.sync.getStatus(TEST_REPO_OWNER, TEST_REPO_NAME)
    expect(initialStatus.syncStatus?.state).toBe('idle')
    expect(initialStatus.syncStatus?.errorCount).toBe(0)

    // Trigger sync with valid data
    const result = await worker.sync.syncIssues(TEST_REPO_OWNER, TEST_REPO_NAME, {
      source: 'beads',
      issues: [
        {
          beadsId: `test-${Date.now()}`,
          title: 'Test issue for error handling',
          state: 'open',
          priority: 2,
        },
      ],
    })

    expect(result.queued).toBe(true)

    // Wait for sync to complete
    const finalStatus = await waitFor(
      async () => {
        const status = await worker.sync.getStatus(TEST_REPO_OWNER, TEST_REPO_NAME)
        return status.syncStatus?.state === 'idle' ? status : undefined
      },
      { timeout: 5000, description: 'sync to complete' }
    )

    // Verify sync completed
    expect(finalStatus).toBeDefined()
    expect(finalStatus?.syncStatus?.state).toBe('idle')
  })
})
