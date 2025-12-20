/**
 * Linear Integration
 * GraphQL client, OAuth, and sync logic for Linear.app
 */

import type { Env } from '../types'
import { storeSecret, getSecret, upsertSecret, type VaultEnv } from '../auth/vault'

// ============================================
// Linear GraphQL Types
// ============================================

export interface LinearIssue {
  id: string
  identifier: string // e.g., "TODO-123"
  title: string
  description?: string
  priority: number // 0=urgent, 1=high, 2=medium, 3=low, 4=none
  state: {
    id: string
    name: string
    type: string // "backlog" | "unstarted" | "started" | "completed" | "canceled"
  }
  assignee?: {
    id: string
    name: string
    email: string
  }
  labels: {
    nodes: Array<{
      id: string
      name: string
      color: string
    }>
  }
  cycle?: {
    id: string
    name: string
    startsAt: string
    endsAt: string
  }
  project?: {
    id: string
    name: string
  }
  createdAt: string
  updatedAt: string
  completedAt?: string
  canceledAt?: string
}

export interface LinearCycle {
  id: string
  name: string
  number: number
  startsAt: string
  endsAt: string
  completedAt?: string
}

export interface LinearProject {
  id: string
  name: string
  description?: string
  state: string
  icon?: string
  color?: string
}

export interface LinearWebhookPayload {
  action: string // "create" | "update" | "remove"
  type: string // "Issue" | "Cycle" | "Project" | "Comment"
  data: any
  url: string
  createdAt: string
  organizationId: string
  webhookId: string
}

// ============================================
// Linear GraphQL Client
// ============================================

const LINEAR_API_URL = 'https://api.linear.app/graphql'

export class LinearClient {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private async query<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
    const response = await fetch(LINEAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Linear API error: ${error}`)
    }

    const result = await response.json()

    if (result.errors) {
      throw new Error(`Linear GraphQL error: ${JSON.stringify(result.errors)}`)
    }

    return result.data
  }

  /**
   * Get viewer (current user) info
   */
  async getViewer() {
    const query = `
      query {
        viewer {
          id
          name
          email
          organization {
            id
            name
            urlKey
          }
        }
      }
    `
    return this.query(query)
  }

  /**
   * Get all teams in the workspace
   */
  async getTeams() {
    const query = `
      query {
        teams {
          nodes {
            id
            name
            key
          }
        }
      }
    `
    const data = await this.query(query)
    return data.teams.nodes
  }

  /**
   * Get issues (optionally filtered by team)
   */
  async getIssues(teamId?: string, first = 50, after?: string): Promise<{
    nodes: LinearIssue[]
    pageInfo: { hasNextPage: boolean; endCursor?: string }
  }> {
    const query = `
      query($first: Int!, $after: String, $filter: IssueFilter) {
        issues(first: $first, after: $after, filter: $filter) {
          nodes {
            id
            identifier
            title
            description
            priority
            state {
              id
              name
              type
            }
            assignee {
              id
              name
              email
            }
            labels {
              nodes {
                id
                name
                color
              }
            }
            cycle {
              id
              name
              startsAt
              endsAt
            }
            project {
              id
              name
            }
            createdAt
            updatedAt
            completedAt
            canceledAt
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `

    const variables: any = { first, after }
    if (teamId) {
      variables.filter = { team: { id: { eq: teamId } } }
    }

    const data = await this.query(query, variables)
    return data.issues
  }

  /**
   * Get a single issue by ID
   */
  async getIssue(id: string): Promise<LinearIssue> {
    const query = `
      query($id: String!) {
        issue(id: $id) {
          id
          identifier
          title
          description
          priority
          state {
            id
            name
            type
          }
          assignee {
            id
            name
            email
          }
          labels {
            nodes {
              id
              name
              color
            }
          }
          cycle {
            id
            name
            startsAt
            endsAt
          }
          project {
            id
            name
          }
          createdAt
          updatedAt
          completedAt
          canceledAt
        }
      }
    `
    const data = await this.query(query, { id })
    return data.issue
  }

  /**
   * Get cycles for a team
   */
  async getCycles(teamId: string, first = 50): Promise<LinearCycle[]> {
    const query = `
      query($teamId: String!, $first: Int!) {
        team(id: $teamId) {
          cycles(first: $first) {
            nodes {
              id
              name
              number
              startsAt
              endsAt
              completedAt
            }
          }
        }
      }
    `
    const data = await this.query(query, { teamId, first })
    return data.team.cycles.nodes
  }

  /**
   * Get projects
   */
  async getProjects(first = 50): Promise<LinearProject[]> {
    const query = `
      query($first: Int!) {
        projects(first: $first) {
          nodes {
            id
            name
            description
            state
            icon
            color
          }
        }
      }
    `
    const data = await this.query(query, { first })
    return data.projects.nodes
  }

  /**
   * Create an issue
   */
  async createIssue(input: {
    teamId: string
    title: string
    description?: string
    priority?: number
    stateId?: string
    assigneeId?: string
    labelIds?: string[]
    cycleId?: string
    projectId?: string
  }) {
    const query = `
      mutation($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
          }
        }
      }
    `
    const data = await this.query(query, { input })
    return data.issueCreate
  }

  /**
   * Update an issue
   */
  async updateIssue(id: string, input: {
    title?: string
    description?: string
    priority?: number
    stateId?: string
    assigneeId?: string
    labelIds?: string[]
    cycleId?: string
    projectId?: string
  }) {
    const query = `
      mutation($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
          issue {
            id
            identifier
          }
        }
      }
    `
    const data = await this.query(query, { id, input })
    return data.issueUpdate
  }
}

// ============================================
// Linear OAuth & Token Storage
// ============================================

/**
 * Store Linear access token for a user
 */
export async function storeLinearToken(
  env: VaultEnv,
  userId: string,
  accessToken: string,
  organizationId?: string
): Promise<void> {
  await upsertSecret(
    env,
    `linear_token:${userId}`,
    accessToken,
    organizationId ? { organizationId } : undefined
  )
}

/**
 * Get Linear access token for a user
 */
export async function getLinearToken(
  env: VaultEnv,
  userId: string,
  organizationId?: string
): Promise<string | null> {
  const secret = await getSecret(
    env,
    `linear_token:${userId}`,
    organizationId ? { organizationId } : undefined
  )
  return secret?.value || null
}

/**
 * Get Linear client for a user
 */
export async function getLinearClient(
  env: VaultEnv,
  userId: string,
  organizationId?: string
): Promise<LinearClient | null> {
  const token = await getLinearToken(env, userId, organizationId)
  if (!token) return null
  return new LinearClient(token)
}

// ============================================
// Linear to todo.mdx Mapping
// ============================================

/**
 * Map Linear state type to todo.mdx status
 */
export function mapLinearStateToStatus(stateType: string): 'open' | 'in_progress' | 'closed' {
  switch (stateType) {
    case 'backlog':
    case 'unstarted':
      return 'open'
    case 'started':
      return 'in_progress'
    case 'completed':
    case 'canceled':
      return 'closed'
    default:
      return 'open'
  }
}

/**
 * Map Linear priority to todo.mdx priority
 * Linear: 0=urgent, 1=high, 2=medium, 3=low, 4=none
 * todo.mdx: 0=critical, 1=high, 2=medium, 3=low, 4=backlog
 */
export function mapLinearPriority(linearPriority: number): number {
  // Direct mapping works well
  return linearPriority
}

/**
 * Map todo.mdx status to Linear state type
 */
export function mapStatusToLinearState(status: string): string {
  switch (status) {
    case 'open':
      return 'backlog'
    case 'in_progress':
      return 'started'
    case 'closed':
      return 'completed'
    default:
      return 'backlog'
  }
}

/**
 * Map todo.mdx priority to Linear priority
 */
export function mapPriorityToLinear(priority: number): number {
  return priority
}

// ============================================
// Sync Logic
// ============================================

export interface LinearSyncResult {
  issuesCreated: number
  issuesUpdated: number
  cyclesCreated: number
  projectsCreated: number
  errors: string[]
}

/**
 * Sync Linear issues to todo.mdx
 */
export async function syncLinearIssues(
  env: Env & VaultEnv,
  userId: string,
  repoId: string,
  teamId?: string
): Promise<LinearSyncResult> {
  const result: LinearSyncResult = {
    issuesCreated: 0,
    issuesUpdated: 0,
    cyclesCreated: 0,
    projectsCreated: 0,
    errors: [],
  }

  try {
    const client = await getLinearClient(env, userId)
    if (!client) {
      throw new Error('No Linear token found for user')
    }

    // Get all issues (paginated)
    let hasNextPage = true
    let after: string | undefined

    while (hasNextPage) {
      const { nodes: issues, pageInfo } = await client.getIssues(teamId, 50, after)

      for (const linearIssue of issues) {
        try {
          // Check if issue already exists
          const existing = await env.PAYLOAD.find({
            collection: 'issues',
            where: {
              and: [
                { repo: { equals: repoId } },
                { 'linearData.id': { equals: linearIssue.id } },
              ],
            },
            limit: 1,
          })

          const issueData = {
            localId: linearIssue.identifier.toLowerCase(),
            title: linearIssue.title,
            body: linearIssue.description || '',
            state: linearIssue.state.type === 'canceled' ? 'closed' :
                   (linearIssue.state.type === 'completed' ? 'closed' : 'open'),
            status: mapLinearStateToStatus(linearIssue.state.type),
            priority: mapLinearPriority(linearIssue.priority),
            labels: linearIssue.labels.nodes.map(l => l.name),
            assignees: linearIssue.assignee ? [linearIssue.assignee.name] : [],
            repo: repoId,
            linearData: {
              id: linearIssue.id,
              identifier: linearIssue.identifier,
              stateId: linearIssue.state.id,
              stateName: linearIssue.state.name,
              cycleId: linearIssue.cycle?.id,
              projectId: linearIssue.project?.id,
            },
            closedAt: linearIssue.completedAt || linearIssue.canceledAt || undefined,
          }

          if (existing.docs && existing.docs.length > 0) {
            // Update existing issue
            await env.PAYLOAD.update({
              collection: 'issues',
              id: existing.docs[0].id,
              data: issueData,
            })
            result.issuesUpdated++
          } else {
            // Create new issue
            await env.PAYLOAD.create({
              collection: 'issues',
              data: issueData,
            })
            result.issuesCreated++
          }
        } catch (error) {
          result.errors.push(`Failed to sync issue ${linearIssue.identifier}: ${error}`)
        }
      }

      hasNextPage = pageInfo.hasNextPage
      after = pageInfo.endCursor
    }

    // Sync cycles to milestones
    if (teamId) {
      try {
        const cycles = await client.getCycles(teamId)

        for (const cycle of cycles) {
          const existing = await env.PAYLOAD.find({
            collection: 'milestones',
            where: {
              'linearData.id': { equals: cycle.id },
            },
            limit: 1,
          })

          const milestoneData = {
            title: cycle.name,
            description: `Linear Cycle #${cycle.number}`,
            state: cycle.completedAt ? 'closed' : 'open',
            dueOn: cycle.endsAt,
            linearData: {
              id: cycle.id,
              number: cycle.number,
              startsAt: cycle.startsAt,
            },
          }

          if (existing.docs && existing.docs.length > 0) {
            await env.PAYLOAD.update({
              collection: 'milestones',
              id: existing.docs[0].id,
              data: milestoneData,
            })
          } else {
            await env.PAYLOAD.create({
              collection: 'milestones',
              data: milestoneData,
            })
            result.cyclesCreated++
          }
        }
      } catch (error) {
        result.errors.push(`Failed to sync cycles: ${error}`)
      }
    }

    // Sync projects
    try {
      const projects = await client.getProjects()

      for (const project of projects) {
        // Projects could map to epics or milestones
        // For now, we'll track them in issue metadata
        result.projectsCreated++
      }
    } catch (error) {
      result.errors.push(`Failed to sync projects: ${error}`)
    }
  } catch (error) {
    result.errors.push(`Sync failed: ${error}`)
  }

  return result
}

/**
 * Handle Linear webhook event
 */
export async function handleLinearWebhook(
  env: Env & VaultEnv,
  payload: LinearWebhookPayload,
  integrationId: string
): Promise<{ status: string; message?: string }> {
  try {
    // Get integration details
    const integration = await env.PAYLOAD.findByID({
      collection: 'linear-integrations',
      id: integrationId,
    })

    if (!integration) {
      return { status: 'error', message: 'Integration not found' }
    }

    const repoId = integration.repo

    switch (payload.type) {
      case 'Issue':
        return await handleIssueWebhook(env, payload, repoId)
      case 'Cycle':
        return await handleCycleWebhook(env, payload, repoId)
      case 'Project':
        return await handleProjectWebhook(env, payload, repoId)
      default:
        return { status: 'ignored', message: `Unsupported type: ${payload.type}` }
    }
  } catch (error) {
    console.error('Linear webhook error:', error)
    return { status: 'error', message: String(error) }
  }
}

async function handleIssueWebhook(
  env: Env & VaultEnv,
  payload: LinearWebhookPayload,
  repoId: string
): Promise<{ status: string }> {
  const issue = payload.data as LinearIssue

  if (payload.action === 'remove') {
    // Delete the issue
    const existing = await env.PAYLOAD.find({
      collection: 'issues',
      where: {
        and: [
          { repo: { equals: repoId } },
          { 'linearData.id': { equals: issue.id } },
        ],
      },
      limit: 1,
    })

    if (existing.docs && existing.docs.length > 0) {
      await env.PAYLOAD.delete({
        collection: 'issues',
        id: existing.docs[0].id,
      })
    }

    return { status: 'deleted' }
  }

  // Create or update
  const existing = await env.PAYLOAD.find({
    collection: 'issues',
    where: {
      and: [
        { repo: { equals: repoId } },
        { 'linearData.id': { equals: issue.id } },
      ],
    },
    limit: 1,
  })

  const issueData = {
    localId: issue.identifier.toLowerCase(),
    title: issue.title,
    body: issue.description || '',
    state: issue.state.type === 'canceled' || issue.state.type === 'completed' ? 'closed' : 'open',
    status: mapLinearStateToStatus(issue.state.type),
    priority: mapLinearPriority(issue.priority),
    labels: issue.labels.nodes.map(l => l.name),
    assignees: issue.assignee ? [issue.assignee.name] : [],
    repo: repoId,
    linearData: {
      id: issue.id,
      identifier: issue.identifier,
      stateId: issue.state.id,
      stateName: issue.state.name,
      cycleId: issue.cycle?.id,
      projectId: issue.project?.id,
    },
    closedAt: issue.completedAt || issue.canceledAt || undefined,
  }

  if (existing.docs && existing.docs.length > 0) {
    await env.PAYLOAD.update({
      collection: 'issues',
      id: existing.docs[0].id,
      data: issueData,
    })
    return { status: 'updated' }
  } else {
    await env.PAYLOAD.create({
      collection: 'issues',
      data: issueData,
    })
    return { status: 'created' }
  }
}

async function handleCycleWebhook(
  env: Env & VaultEnv,
  payload: LinearWebhookPayload,
  repoId: string
): Promise<{ status: string }> {
  const cycle = payload.data as LinearCycle

  if (payload.action === 'remove') {
    const existing = await env.PAYLOAD.find({
      collection: 'milestones',
      where: {
        'linearData.id': { equals: cycle.id },
      },
      limit: 1,
    })

    if (existing.docs && existing.docs.length > 0) {
      await env.PAYLOAD.delete({
        collection: 'milestones',
        id: existing.docs[0].id,
      })
    }

    return { status: 'deleted' }
  }

  const existing = await env.PAYLOAD.find({
    collection: 'milestones',
    where: {
      'linearData.id': { equals: cycle.id },
    },
    limit: 1,
  })

  const milestoneData = {
    title: cycle.name,
    description: `Linear Cycle #${cycle.number}`,
    state: cycle.completedAt ? 'closed' : 'open',
    dueOn: cycle.endsAt,
    linearData: {
      id: cycle.id,
      number: cycle.number,
      startsAt: cycle.startsAt,
    },
  }

  if (existing.docs && existing.docs.length > 0) {
    await env.PAYLOAD.update({
      collection: 'milestones',
      id: existing.docs[0].id,
      data: milestoneData,
    })
    return { status: 'updated' }
  } else {
    await env.PAYLOAD.create({
      collection: 'milestones',
      data: milestoneData,
    })
    return { status: 'created' }
  }
}

async function handleProjectWebhook(
  env: Env & VaultEnv,
  payload: LinearWebhookPayload,
  repoId: string
): Promise<{ status: string }> {
  // Projects can be tracked in metadata
  // For now, we'll just acknowledge the webhook
  return { status: 'acknowledged' }
}
