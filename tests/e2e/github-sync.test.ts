import { describe, test, expect, beforeEach, afterEach, beforeAll } from 'vitest'
import { createTestWorktree, type Worktree } from '../helpers/worktree'
import * as beads from '../helpers/beads'
import * as github from '../helpers/github'
import { execa } from 'execa'

// Skip all tests in this file if GitHub credentials are not configured
const describeWithGitHub = github.hasGitHubCredentials() ? describe : describe.skip

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

    // Wait a moment for GitHub to process
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Check GitHub for the issue
    const issues = await github.listIssues({ state: 'open' })
    const createdIssue = issues.find((i) => i.title.includes(uniqueTitle))

    expect(createdIssue).toBeDefined()
    expect(createdIssue?.labels.map((l) => (typeof l === 'string' ? l : l.name))).toContain('task')
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

    // Wait for GitHub
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Update to in_progress
    await beads.update(worktree, issueId, { status: 'in_progress' })

    // Push update
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Update status'], { cwd: worktree.path })
    await execa('git', ['push'], { cwd: worktree.path })
    await beads.sync(worktree)

    // Wait for GitHub
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Verify status label on GitHub
    const issues = await github.listIssues({ state: 'open' })
    const issue = issues.find((i) => i.title.includes(uniqueTitle))

    expect(issue).toBeDefined()
    const labels = issue?.labels.map((l) => (typeof l === 'string' ? l : l.name)) || []
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

    // Wait for GitHub
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Close the issue
    await beads.close(worktree, issueId, 'Completed')

    // Push closure
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Close issue'], { cwd: worktree.path })
    await execa('git', ['push'], { cwd: worktree.path })
    await beads.sync(worktree)

    // Wait for GitHub
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Verify closed on GitHub
    const closedIssues = await github.listIssues({ state: 'closed' })
    const closedIssue = closedIssues.find((i) => i.title.includes(uniqueTitle))

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
