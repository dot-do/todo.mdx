/**
 * Priya - Planner Agent
 *
 * Manages roadmap planning and agent assignment through event-driven triggers.
 * Operates at the project level (GitHub Projects sync, can span repos).
 *
 * Core capabilities:
 * - DAG analysis: Find ready issues, critical path
 * - Agent matching: Issue requirements → best-fit agent
 * - Dependency review: Suggest missing deps on issue.created
 * - Capacity-aware: No artificial limits, DAG is the throttle
 */

import type { AgentConfig } from '@todo.mdx/agents.mdx'

/**
 * Priya's persona configuration
 */
export const priyaConfig: AgentConfig = {
  name: 'priya',
  description: 'Planner Agent for autonomous roadmap management',
  capabilities: [
    {
      name: 'planning',
      description: 'Roadmap and project planning',
    },
    {
      name: 'dag-analysis',
      description: 'Dependency graph analysis and critical path identification',
    },
    {
      name: 'agent-matching',
      description: 'Match issues to best-fit agents',
    },
  ],
  autonomy: 'full',
  triggers: [
    {
      event: 'issue.closed',
      handler: 'onIssueClosed',
    },
    {
      event: 'epic.completed',
      handler: 'onEpicCompleted',
    },
    {
      event: 'issue.blocked',
      handler: 'onIssueBlocked',
    },
    {
      event: 'pr.merged',
      handler: 'onPRMerged',
    },
  ],
}

// Export trigger handlers
export { onIssueClosed, onEpicCompleted, onIssueBlocked, onPRMerged } from './triggers'
