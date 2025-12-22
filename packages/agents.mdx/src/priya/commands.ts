/**
 * Priya CLI Commands
 *
 * Commands for interacting with Priya the Product Planner
 */

import { createRuntime } from '../runtime'
import { localTransport } from '../local'
import { assignReadyIssues } from './assignment'
import type { Repo, Issue, WorkflowRuntime } from '../types'
import { priya } from './persona'

/**
 * Get repo info from git remote
 */
async function getRepoFromGit(): Promise<Repo> {
  // This is a simple implementation - could be enhanced
  const { Bun } = globalThis as any
  if (!Bun) {
    throw new Error('Priya commands require Bun runtime')
  }

  const proc = Bun.spawn(['git', 'config', '--get', 'remote.origin.url'], {
    stdout: 'pipe',
  })
  const output = await new Response(proc.stdout).text()
  const url = output.trim()

  // Parse GitHub URL (https://github.com/owner/repo.git or git@github.com:owner/repo.git)
  const match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/)
  if (!match) {
    throw new Error(`Could not parse GitHub URL: ${url}`)
  }

  const [, owner, name] = match

  // Get default branch
  const branchProc = Bun.spawn(['git', 'symbolic-ref', 'refs/remotes/origin/HEAD'], {
    stdout: 'pipe',
  })
  const branchOutput = await new Response(branchProc.stdout).text()
  const defaultBranch = branchOutput.trim().replace('refs/remotes/origin/', '') || 'main'

  return {
    owner,
    name,
    defaultBranch,
    url: `https://github.com/${owner}/${name}`,
  }
}

/**
 * priya assign - Run assignment algorithm once
 */
export async function priyaAssign(): Promise<void> {
  const repo = await getRepoFromGit()
  const transport = localTransport({ repo })
  const runtime = createRuntime({ repo, transport })

  console.log('🔍 Finding ready issues...')
  const results = await assignReadyIssues(runtime)

  if (results.length === 0) {
    console.log('✅ No ready issues to assign')
    return
  }

  console.log(`\n✅ Assigned ${results.length} issue${results.length === 1 ? '' : 's'}:\n`)

  for (const result of results) {
    console.log(`  ${result.issue.id}: ${result.issue.title}`)
    console.log(`    → ${result.agent.name} (${Math.round(result.confidence * 100)}% confidence)`)
    console.log(`    → ${result.reason}\n`)
  }
}

/**
 * priya status - Show assignment queue status
 */
export async function priyaStatus(): Promise<void> {
  const repo = await getRepoFromGit()
  const transport = localTransport({ repo })
  const runtime = createRuntime({ repo, transport })

  const [ready, blocked, inProgress] = await Promise.all([
    runtime.issues.ready(),
    runtime.issues.blocked(),
    runtime.issues.list({ status: 'in_progress' }),
  ])

  console.log('📊 Priya Status Report\n')

  console.log(`Ready to assign: ${ready.length}`)
  if (ready.length > 0) {
    ready.slice(0, 5).forEach(issue => {
      console.log(`  - ${issue.id}: ${issue.title}`)
    })
    if (ready.length > 5) {
      console.log(`  ... and ${ready.length - 5} more`)
    }
  }

  console.log(`\nIn progress: ${inProgress.length}`)
  if (inProgress.length > 0) {
    inProgress.slice(0, 5).forEach(issue => {
      console.log(`  - ${issue.id}: ${issue.title} (${issue.assignee || 'unassigned'})`)
    })
    if (inProgress.length > 5) {
      console.log(`  ... and ${inProgress.length - 5} more`)
    }
  }

  console.log(`\nBlocked: ${blocked.length}`)
  if (blocked.length > 0) {
    blocked.slice(0, 5).forEach(issue => {
      console.log(`  - ${issue.id}: ${issue.title}`)
    })
    if (blocked.length > 5) {
      console.log(`  ... and ${blocked.length - 5} more`)
    }
  }
}

/**
 * priya critical-path - Show critical path analysis
 */
export async function priyaCriticalPath(): Promise<void> {
  const repo = await getRepoFromGit()
  const transport = localTransport({ repo })
  const runtime = createRuntime({ repo, transport })

  console.log('🎯 Critical Path Analysis\n')

  const criticalPath = await runtime.dag.criticalPath()

  if (criticalPath.length === 0) {
    console.log('✅ No critical path found (all issues completed or no dependencies)')
    return
  }

  console.log(`Length: ${criticalPath.length} issues\n`)

  criticalPath.forEach((issue, index) => {
    const marker = index === 0 ? '🔴' : index === criticalPath.length - 1 ? '🏁' : '  '
    console.log(`${marker} ${issue.id}: ${issue.title}`)
    console.log(`   Status: ${issue.status}, Priority: ${issue.priority}`)
    if (issue.assignee) {
      console.log(`   Assigned to: ${issue.assignee}`)
    }
    console.log()
  })

  console.log(`💡 Focus on unblocking the critical path to maximize velocity`)
}

/**
 * priya info - Show Priya agent information
 */
export async function priyaInfo(): Promise<void> {
  console.log(`🤖 ${priya.name}\n`)
  console.log(priya.description)
  console.log(`\nModel: ${priya.model}`)
  console.log(`Autonomy: ${priya.autonomy}`)
  console.log(`\nCapabilities:`)
  priya.capabilities?.forEach(cap => {
    console.log(`  - ${cap.name}: ${cap.description || cap.operations?.join(', ')}`)
  })
}

// ============================================================================
// On-Demand Commands
// ============================================================================

/**
 * Review roadmap result
 */
export interface ReviewRoadmapResult {
  summary: string
  suggestions: Array<{
    type: 'critical_unassigned' | 'blocked' | 'priority' | 'stale' | 'dependency'
    priority: 'high' | 'medium' | 'low'
    message: string
    issueId?: string
    action?: string
  }>
  stats: {
    total: number
    open: number
    inProgress: number
    closed: number
    blocked: number
    ready: number
  }
}

/**
 * priyaReviewRoadmap - Analyze roadmap and provide suggestions
 *
 * Analyzes the current roadmap state and provides actionable suggestions for:
 * - High-priority unassigned issues
 * - Blocked issues on critical path
 * - Priority mismatches
 * - Stale issues
 */
export async function priyaReviewRoadmap(runtime: WorkflowRuntime): Promise<ReviewRoadmapResult> {
  // Get all issues
  const allIssues = await runtime.issues.list()
  const readyIssues = await runtime.dag.ready()
  const blockedIssues = await runtime.issues.blocked()
  const criticalPath = await runtime.dag.criticalPath()

  // Calculate stats
  const stats = {
    total: allIssues.length,
    open: allIssues.filter(i => i.status === 'open').length,
    inProgress: allIssues.filter(i => i.status === 'in_progress').length,
    closed: allIssues.filter(i => i.status === 'closed').length,
    blocked: blockedIssues.length,
    ready: readyIssues.length,
  }

  const suggestions: ReviewRoadmapResult['suggestions'] = []

  // Identify high-priority unassigned issues
  const criticalUnassigned = allIssues.filter(
    i => i.status === 'open' && !i.assignee && i.priority <= 1
  )
  for (const issue of criticalUnassigned) {
    suggestions.push({
      type: 'critical_unassigned',
      priority: 'high',
      message: `Critical issue "${issue.title}" (P${issue.priority}) is unassigned`,
      issueId: issue.id,
      action: 'assign',
    })
  }

  // Identify blocked issues on critical path
  const criticalPathIds = new Set(criticalPath.map(i => i.id))
  const blockedOnCriticalPath = blockedIssues.filter(i => criticalPathIds.has(i.id))
  for (const issue of blockedOnCriticalPath) {
    const blockers = await runtime.dag.blockedBy(issue.id)
    suggestions.push({
      type: 'blocked',
      priority: 'high',
      message: `Critical path issue "${issue.title}" is blocked by ${blockers.length} issue(s)`,
      issueId: issue.id,
      action: 'unblock',
    })
  }

  // Identify stale issues (open for > 90 days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const staleIssues = allIssues.filter(
    i => i.status === 'open' && i.updated < ninetyDaysAgo
  )
  for (const issue of staleIssues) {
    suggestions.push({
      type: 'stale',
      priority: 'low',
      message: `Issue "${issue.title}" has been open for over 90 days`,
      issueId: issue.id,
      action: 'review',
    })
  }

  // Generate summary
  const summary = `Roadmap Analysis: ${stats.total} total issues, ${stats.open} open, ${stats.inProgress} in progress, ${stats.closed} closed. ${suggestions.length} suggestions for improvement.`

  return {
    summary,
    suggestions,
    stats,
  }
}

/**
 * Plan sprint options
 */
export interface PlanSprintOptions {
  capacity?: number
  labels?: string[]
  priorityThreshold?: number
}

/**
 * Plan sprint result
 */
export interface PlanSprintResult {
  selectedIssues: Issue[]
  summary: string
  metrics: {
    totalSelected: number
    byPriority: Record<number, number>
    byType: Record<string, number>
  }
}

/**
 * priyaPlanSprint - Select issues for next sprint
 *
 * Selects ready issues for a sprint based on:
 * - Priority (higher priority first)
 * - Dependencies (only ready issues with no blockers)
 * - Capacity limit
 * - Optional label filtering
 */
export async function priyaPlanSprint(
  runtime: WorkflowRuntime,
  options: PlanSprintOptions = {}
): Promise<PlanSprintResult> {
  const { capacity = 10, labels = [], priorityThreshold = 4 } = options

  // Get ready issues
  let readyIssues = await runtime.dag.ready()

  // Filter by labels if provided
  if (labels.length > 0) {
    readyIssues = readyIssues.filter(issue => {
      if (!issue.labels) return false
      return labels.some(label => issue.labels!.includes(label))
    })
  }

  // Filter by priority threshold
  readyIssues = readyIssues.filter(issue => issue.priority <= priorityThreshold)

  // Sort by priority (lower number = higher priority)
  readyIssues.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority
    }
    // Secondary sort by type (bugs first, then features, then tasks)
    const typeOrder = { bug: 0, feature: 1, task: 2, chore: 3, epic: 4 }
    return (typeOrder[a.type] || 999) - (typeOrder[b.type] || 999)
  })

  // Select up to capacity
  const selectedIssues = readyIssues.slice(0, capacity)

  // Calculate metrics
  const byPriority: Record<number, number> = {}
  const byType: Record<string, number> = {}

  for (const issue of selectedIssues) {
    byPriority[issue.priority] = (byPriority[issue.priority] || 0) + 1
    byType[issue.type] = (byType[issue.type] || 0) + 1
  }

  const summary = `Sprint plan: ${selectedIssues.length} issues selected from ${readyIssues.length} ready issues`

  return {
    selectedIssues,
    summary,
    metrics: {
      totalSelected: selectedIssues.length,
      byPriority,
      byType,
    },
  }
}

/**
 * Triage backlog result
 */
export interface TriageBacklogResult {
  suggestions: Array<{
    issueId: string
    action: 'reprioritize' | 'add_labels' | 'review' | 'close'
    type: 'priority' | 'labels' | 'stale' | 'duplicate'
    reason: string
    suggestedPriority?: number
    suggestedLabels?: string[]
  }>
  categorized: {
    urgent: Issue[]
    normal: Issue[]
    low: Issue[]
  }
  stats: {
    total: number
    needsAction: number
  }
}

/**
 * priyaTriageBacklog - Categorize and prioritize unassigned issues
 *
 * Analyzes the backlog and provides triage suggestions:
 * - Priority mismatches (bugs that should be P0/P1)
 * - Issues needing labels
 * - Stale issues to review or close
 * - Categorization by urgency
 */
export async function priyaTriageBacklog(runtime: WorkflowRuntime): Promise<TriageBacklogResult> {
  // Get open, unassigned issues
  const openIssues = await runtime.issues.list({ status: 'open' })
  const backlogIssues = openIssues.filter(i => !i.assignee)

  const suggestions: TriageBacklogResult['suggestions'] = []

  // Categorize by urgency
  const categorized = {
    urgent: [] as Issue[],
    normal: [] as Issue[],
    low: [] as Issue[],
  }

  for (const issue of backlogIssues) {
    // Check for priority mismatches
    // Bugs should generally be P0 or P1
    if (issue.type === 'bug' && issue.priority > 1) {
      suggestions.push({
        issueId: issue.id,
        action: 'reprioritize',
        type: 'priority',
        reason: 'Bugs should typically be high priority (P0 or P1)',
        suggestedPriority: 1,
      })
    }

    // Check for missing labels
    if (!issue.labels || issue.labels.length === 0) {
      const suggestedLabels: string[] = []
      if (issue.type === 'bug') suggestedLabels.push('bug')
      if (issue.type === 'feature') suggestedLabels.push('enhancement')
      if (issue.title.toLowerCase().includes('security')) suggestedLabels.push('security')
      if (issue.title.toLowerCase().includes('docs') || issue.title.toLowerCase().includes('documentation')) {
        suggestedLabels.push('documentation')
      }

      suggestions.push({
        issueId: issue.id,
        action: 'add_labels',
        type: 'labels',
        reason: 'Issue has no labels',
        suggestedLabels,
      })
    }

    // Check for stale issues (> 180 days)
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
    if (issue.updated < sixMonthsAgo) {
      suggestions.push({
        issueId: issue.id,
        action: 'review',
        type: 'stale',
        reason: `Issue is stale - has not been updated in over 6 months (last update: ${issue.updated.toLocaleDateString()})`,
      })
    }

    // Categorize by urgency
    if (issue.priority <= 1 || issue.type === 'bug') {
      categorized.urgent.push(issue)
    } else if (issue.priority === 2) {
      categorized.normal.push(issue)
    } else {
      categorized.low.push(issue)
    }
  }

  return {
    suggestions,
    categorized,
    stats: {
      total: backlogIssues.length,
      needsAction: suggestions.length,
    },
  }
}
