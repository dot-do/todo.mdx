/**
 * E2E: Beads → GitHub → Worker Sync Test
 *
 * True E2E test that:
 * 1. Adds a beads issue to tests/fixtures/test.mdx submodule
 * 2. Pushes to GitHub (triggers real webhook)
 * 3. Verifies issue appears in worker database via API
 *
 * Requires:
 * - TEST_API_KEY env var
 * - tests/fixtures/test.mdx submodule initialized
 */

import { describe, test, expect, beforeAll } from 'vitest'
import { execa } from 'execa'
import path from 'path'

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

describeWithCredentials('beads → GitHub → worker sync', () => {
  beforeAll(() => {
    if (!hasCredentials) {
      console.log('Skipping E2E sync tests - missing TEST_API_KEY')
    }
  })

  test('pushing beads issue creates GitHub issue and syncs to worker', async () => {
    // 1. Get initial issue count
    const initialStatus = await getRepoStatus()
    const initialCount = initialStatus.issueCount
    console.log(`Initial issue count: ${initialCount}`)

    // 2. Create unique beads issue
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

    // 3. Append to issues.jsonl
    await execa('bash', ['-c', `echo '${issueJson}' >> .beads/issues.jsonl`], {
      cwd: TEST_REPO_PATH,
    })

    // 4. Commit and push
    await execa('git', ['add', '.beads/issues.jsonl'], { cwd: TEST_REPO_PATH })
    await execa('git', ['commit', '-m', `test: E2E sync ${timestamp}`], {
      cwd: TEST_REPO_PATH,
    })
    await execa('git', ['push'], { cwd: TEST_REPO_PATH })

    console.log(`Pushed issue ${issueId}, waiting for sync...`)

    // 5. Wait for issue count to increase
    const finalStatus = await waitFor(
      async () => {
        const status = await getRepoStatus()
        if (status.issueCount > initialCount) {
          return status
        }
        return undefined
      },
      { timeout: 30000, interval: 2000, description: 'issue count to increase' }
    )

    expect(finalStatus.issueCount).toBeGreaterThan(initialCount)
    console.log(`Final issue count: ${finalStatus.issueCount}`)

    // 6. Verify in recent syncs
    const recentImport = finalStatus.recentSyncs.find(
      (s) => s.source === 'beads' && s.action === 'import'
    )
    expect(recentImport).toBeDefined()
  }, 60000) // 60s timeout

  test('GitHub issue shows correct labels from beads priority/type', async () => {
    // Create issue with specific priority and type
    const timestamp = Date.now()
    const issueId = `e2e-labels-${timestamp.toString(36)}`
    const issueTitle = `E2E Labels Test ${timestamp}`
    const issueJson = JSON.stringify({
      id: issueId,
      title: issueTitle,
      description: 'Testing priority P0 and type bug',
      status: 'open',
      priority: 0, // P0
      issue_type: 'bug',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    // Append, commit, push
    await execa('bash', ['-c', `echo '${issueJson}' >> .beads/issues.jsonl`], {
      cwd: TEST_REPO_PATH,
    })
    await execa('git', ['add', '.beads/issues.jsonl'], { cwd: TEST_REPO_PATH })
    await execa('git', ['commit', '-m', `test: E2E labels ${timestamp}`], {
      cwd: TEST_REPO_PATH,
    })
    await execa('git', ['push'], { cwd: TEST_REPO_PATH })

    // Wait for sync
    await new Promise((r) => setTimeout(r, 10000))

    // Check GitHub issue via gh CLI
    const { stdout } = await execa('gh', [
      'issue', 'list',
      '--repo', `${TEST_REPO_OWNER}/${TEST_REPO_NAME}`,
      '--search', issueTitle,
      '--json', 'title,labels',
    ])

    const issues = JSON.parse(stdout)
    const issue = issues.find((i: any) => i.title === issueTitle)

    expect(issue).toBeDefined()
    const labelNames = issue.labels.map((l: any) => l.name)
    expect(labelNames).toContain('P0')
    expect(labelNames).toContain('bug')
  }, 60000)
})
