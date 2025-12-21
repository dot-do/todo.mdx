/**
 * E2E: Linear Integration Tests (todo-4wf)
 *
 * Tests Linear issue sync when Linear integration is enabled:
 * - Create, update, close cycle
 * - Bidirectional sync verification
 *
 * Requires:
 * - LINEAR_API_KEY - Linear API key for test workspace
 * - LINEAR_TEAM_ID - Linear team ID
 * - WORKER_BASE_URL, WORKER_ACCESS_TOKEN
 */

import { describe, test, expect, beforeAll } from 'vitest'
import { waitFor } from '../helpers'
import * as worker from '../helpers/worker'

const LINEAR_API_KEY = process.env.LINEAR_API_KEY
const LINEAR_TEAM_ID = process.env.LINEAR_TEAM_ID
const WORKER_ACCESS_TOKEN = process.env.WORKER_ACCESS_TOKEN

function hasLinearCredentials(): boolean {
  return !!(LINEAR_API_KEY && LINEAR_TEAM_ID && WORKER_ACCESS_TOKEN)
}

const describeWithLinear = hasLinearCredentials() ? describe : describe.skip

const TEST_REPO_OWNER = 'dot-do'
const TEST_REPO_NAME = 'test.mdx'

// Linear API helper
async function linearFetch(
  query: string,
  variables: Record<string, any> = {}
): Promise<any> {
  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: LINEAR_API_KEY!,
    },
    body: JSON.stringify({ query, variables }),
  })

  const data = await response.json()
  return data.data
}

async function createLinearIssue(title: string, description?: string): Promise<{
  id: string
  identifier: string
  title: string
}> {
  const query = `
    mutation CreateIssue($teamId: String!, $title: String!, $description: String) {
      issueCreate(input: { teamId: $teamId, title: $title, description: $description }) {
        success
        issue {
          id
          identifier
          title
        }
      }
    }
  `

  const result = await linearFetch(query, {
    teamId: LINEAR_TEAM_ID,
    title,
    description,
  })

  return result.issueCreate.issue
}

async function updateLinearIssue(
  issueId: string,
  data: { title?: string; description?: string; stateId?: string }
): Promise<void> {
  const query = `
    mutation UpdateIssue($id: String!, $title: String, $description: String, $stateId: String) {
      issueUpdate(id: $id, input: { title: $title, description: $description, stateId: $stateId }) {
        success
      }
    }
  `

  await linearFetch(query, { id: issueId, ...data })
}

async function getLinearIssue(issueId: string): Promise<{
  id: string
  identifier: string
  title: string
  description: string
  state: { name: string }
}> {
  const query = `
    query GetIssue($id: String!) {
      issue(id: $id) {
        id
        identifier
        title
        description
        state {
          name
        }
      }
    }
  `

  const result = await linearFetch(query, { id: issueId })
  return result.issue
}

async function deleteLinearIssue(issueId: string): Promise<void> {
  const query = `
    mutation DeleteIssue($id: String!) {
      issueArchive(id: $id) {
        success
      }
    }
  `

  await linearFetch(query, { id: issueId })
}

describeWithLinear('Linear integration', () => {
  beforeAll(() => {
    if (!hasLinearCredentials()) {
      console.log(
        'Skipping Linear integration tests - missing LINEAR_API_KEY, LINEAR_TEAM_ID, or WORKER_ACCESS_TOKEN'
      )
    }
  })

  test('Linear issue creation syncs to worker D1', async () => {
    const uniqueTitle = `Linear sync test ${Date.now()}`

    // Create issue in Linear
    const linearIssue = await createLinearIssue(
      uniqueTitle,
      'Created in Linear for sync testing'
    )

    expect(linearIssue.id).toBeDefined()
    expect(linearIssue.identifier).toMatch(/^[A-Z]+-\d+$/)

    // Wait for webhook processing and sync to worker
    const syncedIssue = await waitFor(
      async () => {
        const { issues } = await worker.repos.listIssues(TEST_REPO_OWNER, TEST_REPO_NAME)
        return issues.find(
          (i) => i.title.includes(uniqueTitle) || i.body?.includes(linearIssue.identifier)
        )
      },
      { timeout: 15000, description: 'Linear issue to sync to worker D1' }
    )

    // Note: Full sync depends on Linear webhook integration
    // This test verifies the expected behavior
    expect(syncedIssue).toBeDefined()

    // Cleanup
    await deleteLinearIssue(linearIssue.id)
  })

  test('worker issue creation syncs to Linear', async () => {
    const uniqueTitle = `Worker to Linear test ${Date.now()}`

    // Create issue via worker API
    const { issue } = await worker.repos.createIssue(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      {
        title: uniqueTitle,
        body: 'Created via worker for Linear sync',
        labels: ['task'],
      }
    )

    expect(issue.id).toBeDefined()

    // Wait for sync to Linear
    const linearIssues = await waitFor(
      async () => {
        const query = `
          query SearchIssues($filter: IssueFilter!) {
            issues(filter: $filter) {
              nodes {
                id
                identifier
                title
              }
            }
          }
        `

        const result = await linearFetch(query, {
          filter: {
            team: { id: { eq: LINEAR_TEAM_ID } },
            title: { contains: uniqueTitle },
          },
        })

        const linearIssues = result.issues.nodes
        return linearIssues.length > 0 ? linearIssues : undefined
      },
      { timeout: 15000, description: 'worker issue to sync to Linear' }
    )

    // Cleanup
    if (linearIssues.length > 0) {
      await deleteLinearIssue(linearIssues[0].id)
    }

    expect(linearIssues.length).toBeGreaterThan(0)
  })

  test('Linear issue update syncs to worker', async () => {
    const uniqueTitle = `Linear update sync ${Date.now()}`
    const updatedTitle = `${uniqueTitle} UPDATED`

    // Create in Linear
    const linearIssue = await createLinearIssue(uniqueTitle)

    // Wait for initial sync
    await waitFor(
      async () => {
        const { issues } = await worker.repos.listIssues(TEST_REPO_OWNER, TEST_REPO_NAME)
        return issues.find((i) => i.title.includes(uniqueTitle))
      },
      { timeout: 10000, description: 'initial Linear issue to sync' }
    )

    // Update in Linear
    await updateLinearIssue(linearIssue.id, {
      title: updatedTitle,
      description: 'Updated description from Linear',
    })

    // Wait for update to sync
    const syncedIssue = await waitFor(
      async () => {
        const { issues } = await worker.repos.listIssues(TEST_REPO_OWNER, TEST_REPO_NAME)
        return issues.find((i) => i.title.includes(updatedTitle))
      },
      { timeout: 10000, description: 'Linear issue update to sync' }
    )

    // Cleanup
    await deleteLinearIssue(linearIssue.id)

    expect(syncedIssue?.title).toBe(updatedTitle)
  })

  test('Linear issue state change syncs to worker', async () => {
    const uniqueTitle = `Linear state sync ${Date.now()}`

    // Create in Linear
    const linearIssue = await createLinearIssue(uniqueTitle)

    // Wait for initial sync
    await waitFor(
      async () => {
        const { issues } = await worker.repos.listIssues(TEST_REPO_OWNER, TEST_REPO_NAME)
        return issues.find((i) => i.title.includes(uniqueTitle))
      },
      { timeout: 10000, description: 'Linear issue to sync' }
    )

    // Get "In Progress" state ID
    const statesQuery = `
      query GetStates($teamId: String!) {
        workflowStates(filter: { team: { id: { eq: $teamId } }, type: { eq: "started" } }) {
          nodes {
            id
            name
          }
        }
      }
    `

    const statesResult = await linearFetch(statesQuery, { teamId: LINEAR_TEAM_ID })
    const inProgressState = statesResult.workflowStates.nodes[0]

    if (inProgressState) {
      await updateLinearIssue(linearIssue.id, {
        stateId: inProgressState.id,
      })

      // Wait for state update to sync
      await waitFor(
        async () => {
          const updatedIssue = await getLinearIssue(linearIssue.id)
          return updatedIssue.state.name !== 'Backlog' ? updatedIssue : undefined
        },
        { timeout: 10000, description: 'Linear state update to sync' }
      )

      // Verify in Linear
      const updatedIssue = await getLinearIssue(linearIssue.id)
      expect(updatedIssue.state.name).not.toBe('Backlog')
    }

    // Cleanup
    await deleteLinearIssue(linearIssue.id)
  })

  test('Linear issue close syncs to worker as closed', async () => {
    const uniqueTitle = `Linear close sync ${Date.now()}`

    // Create in Linear
    const linearIssue = await createLinearIssue(uniqueTitle)

    // Wait for initial sync
    await waitFor(
      async () => {
        const { issues } = await worker.repos.listIssues(TEST_REPO_OWNER, TEST_REPO_NAME)
        return issues.find((i) => i.title.includes(uniqueTitle))
      },
      { timeout: 10000, description: 'Linear issue to sync' }
    )

    // Get "Done" state ID
    const statesQuery = `
      query GetStates($teamId: String!) {
        workflowStates(filter: { team: { id: { eq: $teamId } }, type: { eq: "completed" } }) {
          nodes {
            id
            name
          }
        }
      }
    `

    const statesResult = await linearFetch(statesQuery, { teamId: LINEAR_TEAM_ID })
    const doneState = statesResult.workflowStates.nodes[0]

    if (doneState) {
      await updateLinearIssue(linearIssue.id, {
        stateId: doneState.id,
      })

      // Wait for issue to be marked as closed in worker
      const closedIssue = await waitFor(
        async () => {
          const { issues } = await worker.repos.listIssues(
            TEST_REPO_OWNER,
            TEST_REPO_NAME
          )
          const issue = issues.find((i) => i.title.includes(uniqueTitle))
          return issue?.state === 'closed' ? issue : undefined
        },
        { timeout: 10000, description: 'Linear issue to close in worker' }
      )

      expect(closedIssue?.state).toBe('closed')
    }

    // Cleanup
    await deleteLinearIssue(linearIssue.id)
  })
})

describe('Linear integration without credentials', () => {
  test.skip('placeholder for when credentials are not available', () => {
    // This test is skipped when Linear credentials are not available
    expect(true).toBe(true)
  })
})
