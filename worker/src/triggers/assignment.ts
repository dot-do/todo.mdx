/**
 * Assignment trigger for todo.mdx
 *
 * Automatically triggers DevelopWorkflow when:
 * - Issue is assigned to an agent (builtin agent ID)
 * - Issue has no open blockers
 * - Issue is not closed
 *
 * Also handles reassignment by canceling previous workflows.
 */

import type { Issue } from 'beads-workflows'
import { getBuiltinAgent, getBuiltinAgentIds } from '../agents/builtin'
import type { AgentDef } from '../agents/base'

/**
 * Check if an issue should trigger a workflow
 */
export function shouldTriggerWorkflow(
  issue: Issue,
  issuesMap: Map<string, Issue>
): boolean {
  // Must have an assignee
  if (!issue.assignee) {
    return false
  }

  // Assignee must be a builtin agent
  const agentIds = getBuiltinAgentIds()
  if (!agentIds.includes(issue.assignee)) {
    return false
  }

  // Issue must not be closed
  if (issue.status === 'closed') {
    return false
  }

  // Issue must have no open blockers
  if (issue.dependsOn.length > 0) {
    for (const depId of issue.dependsOn) {
      const dep = issuesMap.get(depId)
      // If dependency exists and is not closed, issue is blocked
      if (dep && dep.status !== 'closed') {
        return false
      }
    }
  }

  return true
}

/**
 * Workflow namespace interface
 */
interface WorkflowNamespace {
  create(options: { id: string; params: any }): Promise<WorkflowInstance>
  get(id: string): Promise<WorkflowInstance>
}

/**
 * Workflow instance interface
 */
interface WorkflowInstance {
  id: string
  status: 'running' | 'complete' | 'failed' | 'paused'
  pause(): Promise<void>
  resume(): Promise<void>
  terminate(): Promise<void>
  sendEvent(event: { type: string; payload?: unknown }): Promise<void>
}

/**
 * Environment with workflow bindings
 */
interface WorkflowEnv {
  DEVELOP_WORKFLOW: WorkflowNamespace
}

/**
 * Repository info
 */
interface Repo {
  owner: string
  name: string
}

/**
 * Options for handleAssignment
 */
export interface HandleAssignmentOptions {
  issue: Issue
  issuesMap: Map<string, Issue>
  env: WorkflowEnv
  repo: Repo
  installationId: number
  previousAssignee?: string
}

/**
 * Handle assignment of an issue to an agent
 *
 * This function:
 * 1. Checks if workflow should be triggered
 * 2. Cancels previous workflow if reassigned
 * 3. Triggers new DevelopWorkflow with agent config
 */
export async function handleAssignment(
  options: HandleAssignmentOptions
): Promise<WorkflowInstance | null> {
  const { issue, issuesMap, env, repo, installationId, previousAssignee } = options

  // Check if we should trigger a workflow
  if (!shouldTriggerWorkflow(issue, issuesMap)) {
    console.log(
      `[AssignmentTrigger] Issue ${issue.id} does not meet trigger conditions`
    )
    return null
  }

  // Get agent config
  const agentConfig = getBuiltinAgent(issue.assignee!)
  if (!agentConfig) {
    console.error(
      `[AssignmentTrigger] Agent ${issue.assignee} not found in builtin agents`
    )
    return null
  }

  console.log(
    `[AssignmentTrigger] Triggering workflow for issue ${issue.id} assigned to ${agentConfig.name}`
  )

  // Handle reassignment: cancel previous workflow
  if (previousAssignee && previousAssignee !== issue.assignee) {
    const previousAgent = getBuiltinAgent(previousAssignee)
    if (previousAgent) {
      console.log(
        `[AssignmentTrigger] Reassignment detected from ${previousAgent.name} to ${agentConfig.name}`
      )

      try {
        // Try to get and terminate the previous workflow
        const previousWorkflowId = getWorkflowId(issue.id, previousAssignee)
        const previousWorkflow = await env.DEVELOP_WORKFLOW.get(previousWorkflowId)

        if (previousWorkflow && previousWorkflow.status === 'running') {
          console.log(
            `[AssignmentTrigger] Terminating previous workflow ${previousWorkflowId}`
          )
          await previousWorkflow.terminate()
        }
      } catch (error) {
        console.error(
          `[AssignmentTrigger] Failed to terminate previous workflow:`,
          error
        )
        // Continue anyway - better to start new workflow than fail completely
      }
    }
  }

  // Create workflow instance
  const workflowId = getWorkflowId(issue.id, issue.assignee!)
  const instance = await env.DEVELOP_WORKFLOW.create({
    id: workflowId,
    params: {
      repo,
      issue,
      installationId,
      agentConfig,
    },
  })

  console.log(
    `[AssignmentTrigger] Started workflow ${instance.id} for issue ${issue.id}`
  )

  return instance
}

/**
 * Generate a unique workflow ID for an issue and agent
 */
function getWorkflowId(issueId: string, agentId: string): string {
  return `develop-${issueId}-${agentId}-${Date.now()}`
}
