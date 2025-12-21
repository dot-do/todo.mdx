import { z } from 'zod'
import type { Integration, Tool, Connection } from '../types'
import type { Env } from '../../types/env'

/**
 * Helper to get authenticated Linear client from connection
 */
async function getLinearClient(connection: Connection) {
  const { LinearClient } = await import('@linear/sdk')

  const accessToken = connection.externalRef?.accessToken

  if (!accessToken) {
    throw new Error('Linear connection missing accessToken in externalRef')
  }

  return new LinearClient({ accessToken })
}

/**
 * Linear Native Integration
 *
 * Provides tools for interacting with Linear via OAuth.
 * Uses the Linear OAuth access token stored in the connection's externalRef.
 */
export const Linear: Integration = {
  name: 'Linear',
  tools: [
    {
      name: 'createIssue',
      fullName: 'linear.createIssue',
      schema: z.object({
        title: z.string().describe('Issue title'),
        teamId: z.string().describe('Team ID to create issue in'),
        description: z.string().optional().describe('Issue description (markdown)'),
        priority: z.number().min(0).max(4).optional().describe('Priority: 0 (no priority), 1 (urgent), 2 (high), 3 (normal), 4 (low)'),
        stateId: z.string().optional().describe('Workflow state ID'),
        assigneeId: z.string().optional().describe('User ID to assign the issue to'),
        labelIds: z.array(z.string()).optional().describe('Array of label IDs to apply'),
        projectId: z.string().optional().describe('Project ID to add issue to'),
        cycleId: z.string().optional().describe('Cycle ID to add issue to'),
      }),
      execute: async (params, connection, env: Env) => {
        const linear = await getLinearClient(connection)

        const payload: any = {
          title: params.title,
          teamId: params.teamId,
        }

        if (params.description) payload.description = params.description
        if (params.priority !== undefined) payload.priority = params.priority
        if (params.stateId) payload.stateId = params.stateId
        if (params.assigneeId) payload.assigneeId = params.assigneeId
        if (params.labelIds) payload.labelIds = params.labelIds
        if (params.projectId) payload.projectId = params.projectId
        if (params.cycleId) payload.cycleId = params.cycleId

        const issuePayload = await linear.createIssue(payload)
        const issue = await issuePayload.issue

        if (!issue) {
          throw new Error('Failed to create issue')
        }

        return {
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          url: issue.url,
          state: issue.state ? await issue.state.then(s => s?.name) : undefined,
        }
      },
    },
    {
      name: 'updateIssue',
      fullName: 'linear.updateIssue',
      schema: z.object({
        issueId: z.string().describe('Issue ID to update'),
        title: z.string().optional().describe('New title'),
        description: z.string().optional().describe('New description (markdown)'),
        priority: z.number().min(0).max(4).optional().describe('Priority: 0 (no priority), 1 (urgent), 2 (high), 3 (normal), 4 (low)'),
        stateId: z.string().optional().describe('New workflow state ID'),
        assigneeId: z.string().optional().describe('New assignee user ID'),
        labelIds: z.array(z.string()).optional().describe('Replace labels with these IDs'),
        projectId: z.string().optional().describe('Move to project ID'),
        cycleId: z.string().optional().describe('Move to cycle ID'),
      }),
      execute: async (params, connection, env: Env) => {
        const linear = await getLinearClient(connection)

        const payload: any = {}

        if (params.title) payload.title = params.title
        if (params.description !== undefined) payload.description = params.description
        if (params.priority !== undefined) payload.priority = params.priority
        if (params.stateId) payload.stateId = params.stateId
        if (params.assigneeId) payload.assigneeId = params.assigneeId
        if (params.labelIds) payload.labelIds = params.labelIds
        if (params.projectId) payload.projectId = params.projectId
        if (params.cycleId) payload.cycleId = params.cycleId

        const updatePayload = await linear.updateIssue(params.issueId, payload)
        const issue = await updatePayload.issue

        if (!issue) {
          throw new Error('Failed to update issue')
        }

        return {
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          url: issue.url,
          state: issue.state ? await issue.state.then(s => s?.name) : undefined,
        }
      },
    },
    {
      name: 'addComment',
      fullName: 'linear.addComment',
      schema: z.object({
        issueId: z.string().describe('Issue ID to comment on'),
        body: z.string().describe('Comment text (markdown)'),
      }),
      execute: async (params, connection, env: Env) => {
        const linear = await getLinearClient(connection)

        const commentPayload = await linear.createComment({
          issueId: params.issueId,
          body: params.body,
        })

        const comment = await commentPayload.comment

        if (!comment) {
          throw new Error('Failed to create comment')
        }

        return {
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt,
          url: comment.url,
        }
      },
    },
    {
      name: 'listIssues',
      fullName: 'linear.listIssues',
      schema: z.object({
        teamId: z.string().describe('Team ID to list issues from'),
        stateId: z.string().optional().describe('Filter by workflow state ID'),
        assigneeId: z.string().optional().describe('Filter by assignee user ID'),
        projectId: z.string().optional().describe('Filter by project ID'),
        cycleId: z.string().optional().describe('Filter by cycle ID'),
        labelId: z.string().optional().describe('Filter by label ID'),
        first: z.number().optional().default(50).describe('Number of issues to return (max 250)'),
      }),
      execute: async (params, connection, env: Env) => {
        const linear = await getLinearClient(connection)

        const filter: any = {
          team: { id: { eq: params.teamId } },
        }

        if (params.stateId) filter.state = { id: { eq: params.stateId } }
        if (params.assigneeId) filter.assignee = { id: { eq: params.assigneeId } }
        if (params.projectId) filter.project = { id: { eq: params.projectId } }
        if (params.cycleId) filter.cycle = { id: { eq: params.cycleId } }
        if (params.labelId) filter.labels = { id: { eq: params.labelId } }

        const issues = await linear.issues({
          filter,
          first: Math.min(params.first || 50, 250),
        })

        const nodes = await Promise.all(
          issues.nodes.map(async issue => ({
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            url: issue.url,
            state: issue.state ? await issue.state.then(s => s?.name) : undefined,
            priority: issue.priority,
            assignee: issue.assignee ? await issue.assignee.then(a => a?.name) : undefined,
            createdAt: issue.createdAt,
            updatedAt: issue.updatedAt,
          }))
        )

        return {
          issues: nodes,
          hasNextPage: issues.pageInfo.hasNextPage,
        }
      },
    },
    {
      name: 'createProject',
      fullName: 'linear.createProject',
      schema: z.object({
        name: z.string().describe('Project name'),
        teamIds: z.array(z.string()).min(1).describe('Array of team IDs to add to project'),
        description: z.string().optional().describe('Project description (markdown)'),
        state: z.enum(['planned', 'started', 'paused', 'completed', 'canceled']).optional().describe('Project state'),
        targetDate: z.string().optional().describe('Target completion date (ISO 8601)'),
        leadId: z.string().optional().describe('User ID of project lead'),
      }),
      execute: async (params, connection, env: Env) => {
        const linear = await getLinearClient(connection)

        const payload: any = {
          name: params.name,
          teamIds: params.teamIds,
        }

        if (params.description) payload.description = params.description
        if (params.state) payload.state = params.state
        if (params.targetDate) payload.targetDate = params.targetDate
        if (params.leadId) payload.leadId = params.leadId

        const projectPayload = await linear.createProject(payload)
        const project = await projectPayload.project

        if (!project) {
          throw new Error('Failed to create project')
        }

        return {
          id: project.id,
          name: project.name,
          url: project.url,
          state: project.state,
          targetDate: project.targetDate,
        }
      },
    },
    {
      name: 'listTeams',
      fullName: 'linear.listTeams',
      schema: z.object({
        first: z.number().optional().default(50).describe('Number of teams to return'),
      }),
      execute: async (params, connection, env: Env) => {
        const linear = await getLinearClient(connection)

        const teams = await linear.teams({
          first: Math.min(params.first || 50, 250),
        })

        return {
          teams: teams.nodes.map(team => ({
            id: team.id,
            name: team.name,
            key: team.key,
          })),
          hasNextPage: teams.pageInfo.hasNextPage,
        }
      },
    },
    {
      name: 'listStates',
      fullName: 'linear.listStates',
      schema: z.object({
        teamId: z.string().describe('Team ID to list workflow states from'),
      }),
      execute: async (params, connection, env: Env) => {
        const linear = await getLinearClient(connection)

        const states = await linear.workflowStates({
          filter: {
            team: { id: { eq: params.teamId } },
          },
        })

        return {
          states: states.nodes.map(state => ({
            id: state.id,
            name: state.name,
            type: state.type,
            color: state.color,
          })),
        }
      },
    },
    {
      name: 'listLabels',
      fullName: 'linear.listLabels',
      schema: z.object({
        teamId: z.string().optional().describe('Filter by team ID'),
        first: z.number().optional().default(50).describe('Number of labels to return'),
      }),
      execute: async (params, connection, env: Env) => {
        const linear = await getLinearClient(connection)

        const filter: any = {}
        if (params.teamId) filter.team = { id: { eq: params.teamId } }

        const labels = await linear.issueLabels({
          filter: Object.keys(filter).length > 0 ? filter : undefined,
          first: Math.min(params.first || 50, 250),
        })

        return {
          labels: labels.nodes.map(label => ({
            id: label.id,
            name: label.name,
            color: label.color,
          })),
          hasNextPage: labels.pageInfo.hasNextPage,
        }
      },
    },
  ],
}
