/**
 * Data loader for beads and GitHub integration
 */

import type { Issue, Milestone, Stats } from './types.js'

/** Load issues from beads */
export async function loadBeadsIssues(): Promise<Issue[]> {
  try {
    // Dynamic import to make beads-workflows optional
    const moduleName = 'beads-workflows'
    const sdk = await import(/* @vite-ignore */ moduleName)
    const beadsDir = await sdk.findBeadsDir(process.cwd())
    if (!beadsDir) return []

    const rawIssues = await sdk.readIssuesFromJsonl(beadsDir)
    return rawIssues.map((i: any) => mapBeadsIssue(i))
  } catch {
    return []
  }
}

/** Load milestones from beads (epics) */
export async function loadBeadsMilestones(): Promise<Milestone[]> {
  try {
    const moduleName = 'beads-workflows'
    const sdk = await import(/* @vite-ignore */ moduleName)
    const beadsDir = await sdk.findBeadsDir(process.cwd())
    if (!beadsDir) return []

    const rawIssues = await sdk.readIssuesFromJsonl(beadsDir)
    const epics = rawIssues.filter((i: any) => i.type === 'epic')

    return epics.map((epic: any) => {
      // Find all issues that are children of this epic
      const children = rawIssues.filter((i: any) => {
        if (!i.dependencies) return false
        return i.dependencies.some((dep: any) =>
          dep.type === 'parent-child' && dep.depends_on === epic.id
        )
      })

      const total = children.length
      const open = children.filter((i: any) => i.status === 'open').length
      const in_progress = children.filter((i: any) => i.status === 'in_progress').length
      const blocked = children.filter((i: any) => i.status === 'blocked').length
      const closed = children.filter((i: any) => i.status === 'closed').length
      const percent = total > 0 ? Math.round((closed / total) * 100) : 0

      return {
        id: epic.id,
        beadsId: epic.id,
        title: epic.title,
        description: epic.description,
        state: epic.status === 'closed' ? 'closed' : 'open',
        progress: {
          total,
          open,
          in_progress,
          blocked,
          closed,
          percent,
        },
        createdAt: epic.created?.toISOString() || new Date().toISOString(),
        updatedAt: epic.updated?.toISOString() || new Date().toISOString(),
      }
    })
  } catch {
    return []
  }
}

/** Calculate stats from issues */
export function calculateStats(issues: Issue[]): Stats {
  const total = issues.length
  const open = issues.filter(i => i.state === 'open').length
  const in_progress = issues.filter(i => i.state === 'in_progress').length
  const blocked = issues.filter(i => i.state === 'blocked').length
  const closed = issues.filter(i => i.state === 'closed').length
  const percent = total > 0 ? Math.round((closed / total) * 100) : 0

  // Calculate average lead time (days from created to closed)
  const closedIssues = issues.filter(i => i.state === 'closed')
  let avgLeadTime: number | undefined

  if (closedIssues.length > 0) {
    const leadTimes = closedIssues
      .map(i => {
        const created = new Date(i.createdAt).getTime()
        const updated = new Date(i.updatedAt).getTime()
        return (updated - created) / (1000 * 60 * 60 * 24) // Convert to days
      })
      .filter(t => !isNaN(t) && t >= 0)

    if (leadTimes.length > 0) {
      avgLeadTime = Math.round(
        leadTimes.reduce((sum, t) => sum + t, 0) / leadTimes.length
      )
    }
  }

  return {
    total,
    open,
    in_progress,
    blocked,
    closed,
    percent,
    avgLeadTime,
  }
}

/** Map beads issue to Issue type */
function mapBeadsIssue(i: any): Issue {
  // Map beads status to Issue state
  let state: Issue['state'] = 'open'
  if (i.status === 'closed') state = 'closed'
  else if (i.status === 'in_progress') state = 'in_progress'
  else if (i.status === 'blocked') state = 'blocked'

  // Extract dependencies and blockedBy
  const dependencies: string[] = []
  const blockedBy: string[] = []

  if (i.dependencies) {
    for (const dep of i.dependencies) {
      dependencies.push(dep.depends_on)
      if (dep.type === 'blocks') {
        blockedBy.push(dep.depends_on)
      }
    }
  }

  return {
    id: i.id,
    beadsId: i.id,
    title: i.title,
    body: i.description,
    state,
    labels: i.labels || [],
    priority: i.priority,
    type: i.type === 'epic' ? 'feature' : i.type,
    createdAt: i.created?.toISOString() || new Date().toISOString(),
    updatedAt: i.updated?.toISOString() || new Date().toISOString(),
    dependencies,
    blockedBy,
  }
}

/** Load all data (issues, milestones, stats) */
export async function loadAllData(): Promise<{
  issues: Issue[]
  milestones: Milestone[]
  stats: Stats
}> {
  const [issues, milestones] = await Promise.all([
    loadBeadsIssues(),
    loadBeadsMilestones(),
  ])

  const stats = calculateStats(issues)

  return { issues, milestones, stats }
}
