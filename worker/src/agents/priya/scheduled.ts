/**
 * Priya Scheduled Triggers
 *
 * Time-based triggers for the Planner Agent (Priya):
 * - dailyStandup: Summarize status, flag blockers, post to Slack
 * - weeklyPlanning: Groom backlog, rebalance priorities, suggest assignments
 */

import type { Issue } from 'beads-workflows'
import type { WorkflowRuntime } from '@todo.mdx/agents.mdx'

/**
 * Schedule configuration for Priya triggers
 */
export interface ScheduleConfig {
  /** Daily standup schedule (cron format, default: weekday 9am) */
  dailyStandup?: string
  /** Weekly planning schedule (cron format, default: Monday 10am) */
  weeklyPlanning?: string
}

/**
 * Daily standup summary
 *
 * Runs on weekday mornings to:
 * 1. Summarize current work (in-progress issues)
 * 2. Flag blocked issues (especially high priority)
 * 3. Show ready issues available for assignment
 * 4. Post summary to Slack (future integration)
 *
 * Default schedule: Monday-Friday 9am
 */
export async function dailyStandup(
  runtime: WorkflowRuntime
): Promise<string> {
  console.log('[Priya] Running daily standup')

  // Get in-progress issues
  const inProgress = await runtime.issues.list({ status: 'in_progress' })

  // Get blocked issues
  const blocked = await runtime.issues.blocked()

  // Get ready issues
  const ready = await runtime.dag.ready()

  // Build summary
  let summary = '# Daily Standup Summary\n\n'

  summary += `## Status Overview\n`
  summary += `- **${inProgress.length}** in progress\n`
  summary += `- **${blocked.length}** blocked\n`
  summary += `- **${ready.length}** ready\n\n`

  // Flag high-priority blocked issues
  const highPriorityBlocked = blocked.filter(
    (issue) => issue.priority <= 1
  )

  if (highPriorityBlocked.length > 0) {
    summary += `## High Priority Blockers\n\n`
    for (const issue of highPriorityBlocked) {
      summary += `- **${issue.title}** (${issue.id}) - priority ${issue.priority}\n`
    }
    summary += '\n'
  }

  // List in-progress work
  if (inProgress.length > 0) {
    summary += `## In Progress\n\n`
    for (const issue of inProgress) {
      const assignee = issue.assignee || 'unassigned'
      summary += `- ${issue.title} (${issue.id}) - ${assignee}\n`
    }
    summary += '\n'
  }

  // List ready work
  if (ready.length > 0) {
    summary += `## Ready for Assignment\n\n`
    for (const issue of ready.slice(0, 5)) {
      // Show top 5
      summary += `- ${issue.title} (${issue.id}) - priority ${issue.priority}\n`
    }
    if (ready.length > 5) {
      summary += `\n...and ${ready.length - 5} more\n`
    }
    summary += '\n'
  }

  console.log('[Priya] Daily standup completed')
  console.log(summary)

  return summary
}

/**
 * Weekly planning session
 *
 * Runs on Monday mornings to:
 * 1. Analyze critical path - identify longest chains blocking completion
 * 2. Prioritize ready issues based on priority, blockers, and impact
 * 3. Match unassigned issues to best-fit agents
 * 4. Generate planning summary for team review
 *
 * Default schedule: Monday 10am
 */
export async function weeklyPlanning(
  runtime: WorkflowRuntime
): Promise<string> {
  console.log('[Priya] Running weekly planning')

  // Get ready issues
  const ready = await runtime.dag.ready()

  // Get critical path
  const criticalPath = await runtime.dag.criticalPath()

  // Build planning summary
  let plan = '# Weekly Planning Summary\n\n'

  // Analyze critical path
  if (criticalPath.length > 0) {
    plan += `## Critical Path\n\n`
    plan += `The critical path has **${criticalPath.length}** issues:\n\n`
    for (const issue of criticalPath) {
      plan += `- ${issue.title} (${issue.id}) - ${issue.status}\n`
    }
    plan += '\n'
  }

  // Prioritize ready issues
  if (ready.length > 0) {
    // Sort by priority (lower number = higher priority) and number of blockers
    const prioritized = ready.sort((a, b) => {
      // First by priority
      if (a.priority !== b.priority) {
        return a.priority - b.priority
      }
      // Then by number of issues blocked
      const aBlocks = a.blocks?.length || 0
      const bBlocks = b.blocks?.length || 0
      return bBlocks - aBlocks
    })

    plan += `## Ready Issues (${ready.length})\n\n`

    // Show top priority issues
    const topPriority = prioritized.filter((issue) => issue.priority <= 1)
    if (topPriority.length > 0) {
      plan += `### High Priority\n\n`
      for (const issue of topPriority) {
        const blocksCount = issue.blocks?.length || 0
        const blocksText = blocksCount > 0 ? ` - blocks ${blocksCount}` : ''
        plan += `- **${issue.title}** (${issue.id}) - priority ${issue.priority}${blocksText}\n`
      }
      plan += '\n'
    }

    // Suggest assignments for unassigned issues
    const unassigned = ready.filter((issue) => !issue.assignee)
    if (unassigned.length > 0) {
      plan += `### Suggested Assignments\n\n`

      const agents = await runtime.agents.list()
      if (agents.length > 0) {
        for (const issue of unassigned.slice(0, 10)) {
          // Top 10
          const match = await runtime.agents.match(issue)
          if (match) {
            plan += `- **${issue.title}** (${issue.id}) → ${match.agent.name} (${Math.round(match.confidence * 100)}% confidence)\n`
          } else {
            plan += `- **${issue.title}** (${issue.id}) → no agent match\n`
          }
        }
        if (unassigned.length > 10) {
          plan += `\n...and ${unassigned.length - 10} more unassigned\n`
        }
        plan += '\n'
      }
    }
  }

  console.log('[Priya] Weekly planning completed')
  console.log(plan)

  return plan
}
