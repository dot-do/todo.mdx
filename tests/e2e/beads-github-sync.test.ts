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

const TEST_REPO_OWNER = 'dot-do'
const TEST_REPO_NAME = 'test.mdx'
const WORKER_BASE_URL = process.env.WORKER_BASE_URL || 'https://todo.mdx.do'
const TEST_API_KEY = process.env.TEST_API_KEY

// Path to test.mdx submodule
const TEST_REPO_PATH = path.join(__dirname, '..', 'fixtures', 'test.mdx')

const hasCredentials = !!TEST_API_KEY
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
    // Ensure we start with a clean state
    await execa('git', ['pull', '--rebase'], { cwd: TEST_REPO_PATH }).catch(() => {})
  })

  test('pushing beads issue creates GitHub issue and syncs to worker', async () => {
    // 1. Create unique beads issue
    const timestamp = Date.now()
    const issueId = `e2e-${timestamp.toString(36)}`
    const issueTitle = `E2E Test ${timestamp}`
    const issueJson = JSON.stringify({
      id: issueId,
      title: issueTitle,
      description: 'Automated E2E sync test',
      status: 'open',
      priority: 2,
      issue_type: 'task',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    // 2. Append to issues.jsonl
    await execa('bash', ['-c', `echo '${issueJson}' >> .beads/issues.jsonl`], {
      cwd: TEST_REPO_PATH,
    })

    // Verify the append worked
    const { stdout: checkContent } = await execa('cat', ['.beads/issues.jsonl'], {
      cwd: TEST_REPO_PATH,
    })
    console.log(`After append: ${checkContent.trim().split('\n').length} issues, includes ${issueId}: ${checkContent.includes(issueId)}`)

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

  test('GitHub issue shows correct labels from beads priority/type', async () => {
    // Create issue with specific priority and type
    // NOTE: Using P1 instead of P0 due to bd merge bug that strips priority:0
    // See: https://github.com/steveyegge/beads/issues/671
    const timestamp = Date.now()
    const issueId = `e2e-labels-${timestamp.toString(36)}`
    const issueTitle = `E2E Labels Test ${timestamp}`
    const issueJson = JSON.stringify({
      id: issueId,
      title: issueTitle,
      description: 'Testing priority P1 and type bug',
      status: 'open',
      priority: 1, // P1 (workaround for bd merge omitempty bug with P0)
      issue_type: 'bug',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    // Append to issues.jsonl
    await execa('bash', ['-c', `echo '${issueJson}' >> .beads/issues.jsonl`], {
      cwd: TEST_REPO_PATH,
    })

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

  test('GitHub issue syncs back to beads issues.jsonl', async () => {
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
})
