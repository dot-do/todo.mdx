/**
 * E2E: Beads ↔ GitHub Bidirectional Sync Test
 *
 * Tests the FULL bidirectional sync:
 * 1. beads → GitHub: Push beads issue, verify GitHub issue created
 * 2. GitHub → beads: Create GitHub issue, verify it syncs to issues.jsonl
 *
 * Uses tests/fixtures/test.mdx submodule for isolation.
 *
 * Requires:
 * - TEST_API_KEY env var
 * - tests/fixtures/test.mdx submodule initialized
 */

import { describe, test, expect, beforeAll } from 'vitest'
import { execa } from 'execa'
import path from 'path'
import fs from 'fs/promises'
import { hasBdCli } from '../helpers/beads'

const TEST_REPO_OWNER = 'dot-do'
const TEST_REPO_NAME = 'test.mdx'
const WORKER_BASE_URL = process.env.WORKER_BASE_URL || 'https://todo.mdx.do'
const TEST_API_KEY = process.env.TEST_API_KEY

// Path to test.mdx submodule
const TEST_REPO_PATH = path.join(__dirname, '..', 'fixtures', 'test.mdx')

// Check if bd and gh CLIs are available
let hasBd = false
let hasGh = false

async function checkClis() {
  hasBd = await hasBdCli()
  try {
    await execa('gh', ['--version'])
    hasGh = !!process.env.GH_TOKEN || !!process.env.GITHUB_TOKEN
  } catch {
    hasGh = false
  }
}

const hasCredentials = !!TEST_API_KEY
// Skip tests if credentials are missing OR if bd/gh CLIs are not available
// (the check happens in beforeAll since it's async)
const describeWithCredentials = hasCredentials ? describe : describe.skip

async function getRepoStatus(): Promise<{ issueCount: number; recentSyncs: any[] }> {
  const response = await fetch(
    `${WORKER_BASE_URL}/api/repos/${TEST_REPO_OWNER}/${TEST_REPO_NAME}/status`,
    {
      headers: {
        Authorization: `Bearer ${TEST_API_KEY}`,
      },
    }
  )
  if (!response.ok) {
    throw new Error(`Failed to get status: ${response.status}`)
  }
  return response.json()
}

async function waitFor<T>(
  fn: () => Promise<T | undefined>,
  options: { timeout?: number; interval?: number; description?: string } = {}
): Promise<T> {
  const { timeout = 30000, interval = 1000, description = 'condition' } = options
  const start = Date.now()

  while (Date.now() - start < timeout) {
    const result = await fn()
    if (result !== undefined) return result
    await new Promise((r) => setTimeout(r, interval))
  }

  throw new Error(`Timeout waiting for ${description}`)
}

/**
 * Helper to ensure git is up to date before pushing
 * Handles concurrent commits from the worker's commit-back
 */
async function syncAndPush(cwd: string, commitMessage: string): Promise<void> {
  // Check initial state
  const { stdout: beforeContent } = await execa('cat', ['.beads/issues.jsonl'], { cwd })
  const issueCount = beforeContent.trim().split('\n').length
  console.log(`Before commit: ${issueCount} issues in JSONL`)

  // Stage changes
  await execa('git', ['add', '.beads/issues.jsonl'], { cwd })

  // Commit
  await execa('git', ['commit', '-m', commitMessage], { cwd })
  console.log(`Committed: ${commitMessage}`)

  // Push (may need multiple attempts if worker commits during our push)
  let attempts = 5
  while (attempts > 0) {
    try {
      await execa('git', ['push'], { cwd })
      console.log('Push successful')
      return
    } catch (pushError: any) {
      attempts--
      console.log(`Push failed (${attempts} attempts left): ${pushError.stderr || pushError.message}`)
      if (attempts === 0) throw pushError

      // Pull with rebase to integrate remote changes
      try {
        await execa('git', ['pull', '--rebase'], { cwd })
        console.log('Pull rebase: OK')
      } catch (rebaseError: any) {
        // If rebase fails, abort it and try merge instead
        console.log(`Rebase failed: ${rebaseError.stderr || rebaseError.message}`)
        try {
          await execa('git', ['rebase', '--abort'], { cwd })
        } catch {
          // Ignore abort errors
        }
        // Use merge instead of rebase (bd merge driver handles JSONL conflicts)
        await execa('git', ['pull', '--no-rebase'], { cwd })
        console.log('Pull merge: OK')
      }

      // Verify our issue is still present after the merge/rebase
      const { stdout: afterContent } = await execa('cat', ['.beads/issues.jsonl'], { cwd })
      const afterCount = afterContent.trim().split('\n').length
      console.log(`After pull: ${afterCount} issues in JSONL`)
    }
  }
}

describeWithCredentials('beads → GitHub → worker sync', () => {
  beforeAll(async () => {
    if (!hasCredentials) {
      console.log('Skipping E2E sync tests - missing TEST_API_KEY')
      return
    }
    // Check if required CLIs are available
    await checkClis()
    if (!hasBd) {
      console.log('Skipping beads-github-sync tests - bd CLI not installed')
    }
    if (!hasGh) {
      console.log('Skipping beads-github-sync tests - gh CLI not available or GH_TOKEN not set')
    }
    // Ensure we start with a clean state
    if (hasBd && hasGh) {
      await execa('git', ['pull', '--rebase'], { cwd: TEST_REPO_PATH }).catch(() => {})
    }
  })

  test('pushing beads issue creates GitHub issue and syncs to worker', async (ctx) => {
    // Skip if CLIs not available
    if (!hasBd || !hasGh) ctx.skip()
    // 1. Create unique beads issue using bd create
    // NOTE: We must use bd create instead of appending to JSONL directly,
    // because the pre-commit hook runs `bd sync --flush-only` which overwrites
    // the JSONL file from the SQLite database.
    const timestamp = Date.now()
    const issueTitle = `E2E Test ${timestamp}`

    const { stdout: createOutput } = await execa('bd', [
      'create',
      '--title', issueTitle,
      '--type', 'task',
      '--priority', '2',
    ], {
      cwd: TEST_REPO_PATH,
    })
    console.log(`Created beads issue: ${createOutput.trim()}`)

    // Extract the issue ID from the output (e.g., "Created issue: e2e-abc123")
    const issueIdMatch = createOutput.match(/issue:\s*(\S+)/) || createOutput.match(/Created:\s*(\S+)/)
    const issueId = issueIdMatch?.[1] || `e2e-${timestamp.toString(36)}`
    console.log(`Issue ID: ${issueId}`)

    // Flush changes from SQLite to JSONL file
    await execa('bd', ['sync', '--flush-only'], { cwd: TEST_REPO_PATH })

    // Verify the issue is in the JSONL
    const { stdout: checkContent } = await execa('cat', ['.beads/issues.jsonl'], {
      cwd: TEST_REPO_PATH,
    })
    console.log(`After flush: ${checkContent.trim().split('\n').length} issues, includes ${issueId}: ${checkContent.includes(issueId)}`)

    // 3. Sync and push (handles concurrent commits from worker)
    await syncAndPush(TEST_REPO_PATH, `test: E2E sync ${timestamp}`)
    console.log(`Pushed issue ${issueId}, waiting for GitHub issue...`)

    // 4. Wait a bit for worker to process webhook and commit back
    await new Promise((r) => setTimeout(r, 5000))

    // 5. Pull and verify the issue is still there after worker's commit
    await execa('git', ['pull', '--rebase'], { cwd: TEST_REPO_PATH }).catch(() => {})
    const { stdout: jsonlContent } = await execa('cat', ['.beads/issues.jsonl'], {
      cwd: TEST_REPO_PATH,
    })
    const issueInFile = jsonlContent.includes(issueId)
    console.log(`After worker sync, issue ${issueId} in JSONL: ${issueInFile}`)

    // 5. Wait for GitHub issue to be created (verify directly on GitHub)
    // Longer timeout for first test since worker may need warmup
    const ghIssue = await waitFor(
      async () => {
        const { stdout } = await execa('gh', [
          'issue',
          'list',
          '--repo',
          `${TEST_REPO_OWNER}/${TEST_REPO_NAME}`,
          '--search',
          issueTitle,
          '--json',
          'title,number',
        ])
        const issues = JSON.parse(stdout)
        return issues.find((i: any) => i.title === issueTitle)
      },
      { timeout: 45000, interval: 3000, description: 'GitHub issue to be created' }
    )

    expect(ghIssue).toBeDefined()
    console.log(`GitHub issue #${ghIssue.number} created`)

    // 6. Verify it's also tracked in the worker
    const status = await getRepoStatus()
    expect(status.issueCount).toBeGreaterThan(0)
  }, 90000) // 90s timeout

  test('GitHub issue shows correct labels from beads priority/type', async (ctx) => {
    if (!hasBd || !hasGh) ctx.skip()
    // Create issue with specific priority and type using bd create
    // NOTE: Using P1 instead of P0 due to bd merge bug that strips priority:0
    // See: https://github.com/steveyegge/beads/issues/671
    const timestamp = Date.now()
    const issueTitle = `E2E Labels Test ${timestamp}`

    const { stdout: createOutput } = await execa('bd', [
      'create',
      '--title', issueTitle,
      '--type', 'bug',
      '--priority', '1', // P1 (workaround for bd merge omitempty bug with P0)
    ], {
      cwd: TEST_REPO_PATH,
    })
    console.log(`Created beads issue: ${createOutput.trim()}`)

    // Extract the issue ID from the output
    const issueIdMatch = createOutput.match(/issue:\s*(\S+)/) || createOutput.match(/Created:\s*(\S+)/)
    const issueId = issueIdMatch?.[1] || `e2e-labels-${timestamp.toString(36)}`
    console.log(`Issue ID: ${issueId}`)

    // Flush changes from SQLite to JSONL file
    await execa('bd', ['sync', '--flush-only'], { cwd: TEST_REPO_PATH })

    // Sync and push (handles concurrent commits from worker)
    await syncAndPush(TEST_REPO_PATH, `test: E2E labels ${timestamp}`)
    console.log(`Pushed labels issue ${issueId}, waiting for GitHub issue...`)

    // Wait for GitHub issue with correct labels
    const ghIssue = await waitFor(
      async () => {
        const { stdout } = await execa('gh', [
          'issue',
          'list',
          '--repo',
          `${TEST_REPO_OWNER}/${TEST_REPO_NAME}`,
          '--search',
          issueTitle,
          '--json',
          'title,labels',
        ])
        const issues = JSON.parse(stdout)
        return issues.find((i: any) => i.title === issueTitle)
      },
      { timeout: 30000, interval: 2000, description: 'GitHub issue with labels' }
    )

    expect(ghIssue).toBeDefined()
    const labelNames = ghIssue.labels.map((l: any) => l.name)
    expect(labelNames).toContain('P1')
    expect(labelNames).toContain('bug')
  }, 60000)

  test('GitHub issue syncs back to beads issues.jsonl', async (ctx) => {
    if (!hasBd || !hasGh) ctx.skip()
    // 1. Create a GitHub issue directly via gh CLI
    const timestamp = Date.now()
    const issueTitle = `GitHub-created issue ${timestamp}`
    const issueBody = 'Created directly on GitHub, should sync to beads'

    const { stdout: createOutput } = await execa('gh', [
      'issue', 'create',
      '--repo', `${TEST_REPO_OWNER}/${TEST_REPO_NAME}`,
      '--title', issueTitle,
      '--body', issueBody,
      '--label', 'P1,task',
    ])

    // Extract issue number from output (e.g., "https://github.com/dot-do/test.mdx/issues/123")
    const issueUrl = createOutput.trim()
    const issueNumber = issueUrl.split('/').pop()
    console.log(`Created GitHub issue #${issueNumber}`)

    // 2. Wait for webhook to process and sync back to repo
    await new Promise((r) => setTimeout(r, 15000))

    // 3. Pull latest changes
    await execa('git', ['pull', '--rebase'], { cwd: TEST_REPO_PATH })

    // 4. Read issues.jsonl and verify the GitHub issue is there
    const jsonlPath = path.join(TEST_REPO_PATH, '.beads', 'issues.jsonl')
    const jsonlContent = await fs.readFile(jsonlPath, 'utf-8')
    const issues = jsonlContent.trim().split('\n').map((line) => JSON.parse(line))

    // Find the issue by title or external_ref
    const syncedIssue = issues.find(
      (i) => i.title === issueTitle || i.external_ref?.includes(issueNumber)
    )

    expect(syncedIssue).toBeDefined()
    expect(syncedIssue?.title).toBe(issueTitle)
    expect(syncedIssue?.priority).toBe(1) // P1
    expect(syncedIssue?.issue_type).toBe('task')
  }, 60000)

  test('GitHub issue close syncs back to beads as closed', async (ctx) => {
    if (!hasBd || !hasGh) ctx.skip()
    // 1. Create a GitHub issue
    const timestamp = Date.now()
    const issueTitle = `GitHub close sync ${timestamp}`

    const { stdout: createOutput } = await execa('gh', [
      'issue', 'create',
      '--repo', `${TEST_REPO_OWNER}/${TEST_REPO_NAME}`,
      '--title', issueTitle,
      '--body', 'Issue to test close sync from GitHub to beads',
      '--label', 'P2,task',
    ])

    const issueUrl = createOutput.trim()
    const issueNumber = issueUrl.split('/').pop()
    console.log(`Created GitHub issue #${issueNumber}`)

    // 2. Wait for initial sync to beads
    await new Promise((r) => setTimeout(r, 10000))
    await execa('git', ['pull', '--rebase'], { cwd: TEST_REPO_PATH })

    // 3. Verify issue exists in beads as open
    let jsonlPath = path.join(TEST_REPO_PATH, '.beads', 'issues.jsonl')
    let jsonlContent = await fs.readFile(jsonlPath, 'utf-8')
    let issues = jsonlContent.trim().split('\n').map((line) => JSON.parse(line))
    let syncedIssue = issues.find(
      (i) => i.title === issueTitle || i.external_ref?.includes(issueNumber)
    )
    expect(syncedIssue).toBeDefined()
    expect(syncedIssue?.status).toBe('open')

    // 4. Close the issue on GitHub
    await execa('gh', [
      'issue', 'close',
      '--repo', `${TEST_REPO_OWNER}/${TEST_REPO_NAME}`,
      issueNumber!,
    ])
    console.log(`Closed GitHub issue #${issueNumber}`)

    // 5. Wait for close webhook to sync back
    await new Promise((r) => setTimeout(r, 15000))
    await execa('git', ['pull', '--rebase'], { cwd: TEST_REPO_PATH })

    // 6. Verify issue is now closed in beads
    jsonlContent = await fs.readFile(jsonlPath, 'utf-8')
    issues = jsonlContent.trim().split('\n').map((line) => JSON.parse(line))
    syncedIssue = issues.find(
      (i) => i.title === issueTitle || i.external_ref?.includes(issueNumber)
    )

    expect(syncedIssue).toBeDefined()
    expect(syncedIssue?.status).toBe('closed')
  }, 90000)

  test('GitHub label changes sync back to beads priority and type', async (ctx) => {
    if (!hasBd || !hasGh) ctx.skip()
    // 1. Create a GitHub issue with initial labels
    const timestamp = Date.now()
    const issueTitle = `GitHub label sync ${timestamp}`

    const { stdout: createOutput } = await execa('gh', [
      'issue', 'create',
      '--repo', `${TEST_REPO_OWNER}/${TEST_REPO_NAME}`,
      '--title', issueTitle,
      '--body', 'Issue to test label sync from GitHub to beads',
      '--label', 'P2,task',
    ])

    const issueUrl = createOutput.trim()
    const issueNumber = issueUrl.split('/').pop()
    console.log(`Created GitHub issue #${issueNumber} with P2,task`)

    // 2. Wait for initial sync
    await new Promise((r) => setTimeout(r, 10000))
    await execa('git', ['pull', '--rebase'], { cwd: TEST_REPO_PATH })

    // 3. Verify initial state
    let jsonlPath = path.join(TEST_REPO_PATH, '.beads', 'issues.jsonl')
    let jsonlContent = await fs.readFile(jsonlPath, 'utf-8')
    let issues = jsonlContent.trim().split('\n').map((line) => JSON.parse(line))
    let syncedIssue = issues.find(
      (i) => i.title === issueTitle || i.external_ref?.includes(issueNumber)
    )
    expect(syncedIssue).toBeDefined()
    expect(syncedIssue?.priority).toBe(2)
    expect(syncedIssue?.issue_type).toBe('task')

    // 4. Update labels on GitHub (change priority to P1, type to bug)
    await execa('gh', [
      'issue', 'edit',
      '--repo', `${TEST_REPO_OWNER}/${TEST_REPO_NAME}`,
      issueNumber!,
      '--remove-label', 'P2,task',
      '--add-label', 'P1,bug',
    ])
    console.log(`Updated GitHub issue #${issueNumber} to P1,bug`)

    // 5. Wait for label change webhook to sync
    await new Promise((r) => setTimeout(r, 15000))
    await execa('git', ['pull', '--rebase'], { cwd: TEST_REPO_PATH })

    // 6. Verify labels synced to beads
    jsonlContent = await fs.readFile(jsonlPath, 'utf-8')
    issues = jsonlContent.trim().split('\n').map((line) => JSON.parse(line))
    syncedIssue = issues.find(
      (i) => i.title === issueTitle || i.external_ref?.includes(issueNumber)
    )

    expect(syncedIssue).toBeDefined()
    expect(syncedIssue?.priority).toBe(1) // P1
    expect(syncedIssue?.issue_type).toBe('bug')
  }, 90000)

  test('GitHub title and body updates sync back to beads', async (ctx) => {
    if (!hasBd || !hasGh) ctx.skip()
    // 1. Create a GitHub issue
    const timestamp = Date.now()
    const originalTitle = `GitHub edit sync ${timestamp}`
    const originalBody = 'Original body content'

    const { stdout: createOutput } = await execa('gh', [
      'issue', 'create',
      '--repo', `${TEST_REPO_OWNER}/${TEST_REPO_NAME}`,
      '--title', originalTitle,
      '--body', originalBody,
      '--label', 'P2,task',
    ])

    const issueUrl = createOutput.trim()
    const issueNumber = issueUrl.split('/').pop()
    console.log(`Created GitHub issue #${issueNumber}`)

    // 2. Wait for initial sync
    await new Promise((r) => setTimeout(r, 10000))
    await execa('git', ['pull', '--rebase'], { cwd: TEST_REPO_PATH })

    // 3. Verify initial state
    let jsonlPath = path.join(TEST_REPO_PATH, '.beads', 'issues.jsonl')
    let jsonlContent = await fs.readFile(jsonlPath, 'utf-8')
    let issues = jsonlContent.trim().split('\n').map((line) => JSON.parse(line))
    let syncedIssue = issues.find(
      (i) => i.title === originalTitle || i.external_ref?.includes(issueNumber)
    )
    expect(syncedIssue).toBeDefined()
    expect(syncedIssue?.title).toBe(originalTitle)

    // 4. Update title and body on GitHub
    const updatedTitle = `Updated: ${originalTitle}`
    const updatedBody = 'Updated body content with more details'

    await execa('gh', [
      'issue', 'edit',
      '--repo', `${TEST_REPO_OWNER}/${TEST_REPO_NAME}`,
      issueNumber!,
      '--title', updatedTitle,
      '--body', updatedBody,
    ])
    console.log(`Updated GitHub issue #${issueNumber} title and body`)

    // 5. Wait for edit webhook to sync
    await new Promise((r) => setTimeout(r, 15000))
    await execa('git', ['pull', '--rebase'], { cwd: TEST_REPO_PATH })

    // 6. Verify updates synced to beads
    jsonlContent = await fs.readFile(jsonlPath, 'utf-8')
    issues = jsonlContent.trim().split('\n').map((line) => JSON.parse(line))
    syncedIssue = issues.find(
      (i) => i.title === updatedTitle || i.external_ref?.includes(issueNumber)
    )

    expect(syncedIssue).toBeDefined()
    expect(syncedIssue?.title).toBe(updatedTitle)
    expect(syncedIssue?.description).toContain('Updated body content')
  }, 90000)
})
