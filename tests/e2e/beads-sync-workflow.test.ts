/**
 * E2E: Beads Sync Workflow Test
 *
 * Tests the durable workflow that syncs all beads issues to GitHub
 * on installation or manual trigger.
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

const TEST_REPO_PATH = path.join(__dirname, '..', 'fixtures', 'test.mdx')

const hasCredentials = !!TEST_API_KEY
const describeWithCredentials = hasCredentials ? describe : describe.skip

async function triggerSyncWorkflow(): Promise<{ workflowId: string }> {
  const response = await fetch(
    `${WORKER_BASE_URL}/api/repos/${TEST_REPO_OWNER}/${TEST_REPO_NAME}/sync/init`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TEST_API_KEY}`,
      },
    }
  )
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to trigger sync: ${response.status} ${error}`)
  }
  return response.json()
}

async function getWorkflowStatus(workflowId: string): Promise<{ status: string; progress?: number }> {
  const response = await fetch(
    `${WORKER_BASE_URL}/api/workflows/${workflowId}`,
    {
      headers: {
        Authorization: `Bearer ${TEST_API_KEY}`,
      },
    }
  )
  if (!response.ok) {
    throw new Error(`Failed to get workflow status: ${response.status}`)
  }
  return response.json()
}

async function waitForWorkflow(workflowId: string, timeout = 120000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const status = await getWorkflowStatus(workflowId)
    if (status.status === 'complete') return
    if (status.status === 'failed') throw new Error('Workflow failed')
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error('Workflow timeout')
}

async function getBeadsIssueCount(): Promise<number> {
  const { stdout } = await execa('cat', ['.beads/issues.jsonl'], { cwd: TEST_REPO_PATH })
  return stdout.trim().split('\n').filter(Boolean).length
}

async function getGitHubIssueCount(): Promise<number> {
  const { stdout } = await execa('gh', [
    'issue', 'list',
    '--repo', `${TEST_REPO_OWNER}/${TEST_REPO_NAME}`,
    '--state', 'all',
    '--limit', '500',
    '--json', 'number',
  ])
  return JSON.parse(stdout).length
}

describeWithCredentials('BeadsSyncWorkflow', () => {
  beforeAll(async () => {
    // Ensure we have latest from remote
    await execa('git', ['pull', '--rebase'], { cwd: TEST_REPO_PATH }).catch(() => {})
  })

  test('sync/init triggers workflow that creates GitHub issues for all beads issues', async () => {
    // Get initial counts
    const beadsCount = await getBeadsIssueCount()
    const initialGhCount = await getGitHubIssueCount()

    console.log(`Beads issues: ${beadsCount}, GitHub issues before: ${initialGhCount}`)

    // Trigger sync workflow
    const { workflowId } = await triggerSyncWorkflow()
    console.log(`Triggered workflow: ${workflowId}`)

    // Wait for completion (may take a while for many issues)
    await waitForWorkflow(workflowId)
    console.log('Workflow complete')

    // Verify GitHub issues were created
    const finalGhCount = await getGitHubIssueCount()
    console.log(`GitHub issues after: ${finalGhCount}`)

    // After sync, GitHub should have at least as many issues as beads
    // (may be more if issues were created via GitHub directly)
    expect(finalGhCount).toBeGreaterThanOrEqual(beadsCount)

    // Count should either increase (new issues synced) or stay the same (already synced)
    expect(finalGhCount).toBeGreaterThanOrEqual(initialGhCount)
  }, 180000) // 3 minute timeout for large syncs

  test('workflow is idempotent - running twice does not duplicate issues', async () => {
    const beforeCount = await getGitHubIssueCount()

    // Trigger sync again
    const { workflowId } = await triggerSyncWorkflow()
    await waitForWorkflow(workflowId)

    const afterCount = await getGitHubIssueCount()

    // Count should be the same (no duplicates created)
    expect(afterCount).toBe(beforeCount)
  }, 120000)
})
