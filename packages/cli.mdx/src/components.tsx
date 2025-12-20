/**
 * Built-in MDX components for cli.mdx
 * These components render to both terminal and markdown
 */

import React from 'react'
import type {
  ComponentProps,
  IssuesProps,
  RoadmapProps,
  CommandProps,
  StatsProps,
  AgentProps,
  Issue,
  Milestone,
  Stats,
} from './types.js'
import { Text } from './renderer.js'

/** Global context for component data */
let globalIssues: Issue[] = []
let globalMilestones: Milestone[] = []
let globalStats: Stats = {
  total: 0,
  open: 0,
  in_progress: 0,
  blocked: 0,
  closed: 0,
  percent: 0,
}

/** Set global data for components */
export function setComponentData(data: {
  issues?: Issue[]
  milestones?: Milestone[]
  stats?: Stats
}) {
  if (data.issues) globalIssues = data.issues
  if (data.milestones) globalMilestones = data.milestones
  if (data.stats) globalStats = data.stats
}

/** Get global data */
export function getComponentData() {
  return {
    issues: globalIssues,
    milestones: globalMilestones,
    stats: globalStats,
  }
}

/** Issues - All issues */
export function Issues({ limit = 10, status, priority, type, labels }: IssuesProps = {}) {
  let filtered = [...globalIssues]

  if (status) {
    filtered = filtered.filter(i => i.state === status)
  }

  if (priority !== undefined) {
    filtered = filtered.filter(i => i.priority === priority)
  }

  if (type) {
    filtered = filtered.filter(i => i.type === type)
  }

  if (labels?.length) {
    filtered = filtered.filter(i =>
      labels.some(label => i.labels?.includes(label))
    )
  }

  filtered = filtered.slice(0, limit)

  if (filtered.length === 0) {
    return <Text style={{ dim: true }}>No issues found</Text>
  }

  return (
    <>
      {filtered.map(issue => (
        <React.Fragment key={issue.id}>
          <IssueItem issue={issue} />
          {'\n'}
        </React.Fragment>
      ))}
    </>
  )
}

/** Issues.Open - Open issues only */
Issues.Open = function IssuesOpen({ limit = 10 }: IssuesProps = {}) {
  return <Issues status="open" limit={limit} />
}

/** Issues.InProgress - In progress issues */
Issues.InProgress = function IssuesInProgress({ limit = 10 }: IssuesProps = {}) {
  return <Issues status="in_progress" limit={limit} />
}

/** Issues.Blocked - Blocked issues */
Issues.Blocked = function IssuesBlocked({ limit = 10 }: IssuesProps = {}) {
  return <Issues status="blocked" limit={limit} />
}

/** Issues.Closed - Closed issues */
Issues.Closed = function IssuesClosed({ limit = 10 }: IssuesProps = {}) {
  return <Issues status="closed" limit={limit} />
}

/** Issues.Ready - Ready to work (open with no blockers) */
Issues.Ready = function IssuesReady({ limit = 10 }: IssuesProps = {}) {
  const ready = globalIssues
    .filter(i => i.state === 'open' && (!i.blockedBy || i.blockedBy.length === 0))
    .slice(0, limit)

  if (ready.length === 0) {
    return <Text style={{ dim: true }}>No issues ready to work</Text>
  }

  return (
    <>
      {ready.map(issue => (
        <React.Fragment key={issue.id}>
          <IssueItem issue={issue} />
          {'\n'}
        </React.Fragment>
      ))}
    </>
  )
}

/** Roadmap - Show milestones and progress */
export function Roadmap({
  limit = 5,
  showProgress = true,
  showDates = true,
}: RoadmapProps = {}) {
  const milestones = globalMilestones.slice(0, limit)

  if (milestones.length === 0) {
    return <Text style={{ dim: true }}>No milestones</Text>
  }

  return (
    <>
      {milestones.map(milestone => (
        <React.Fragment key={milestone.id}>
          <MilestoneItem
            milestone={milestone}
            showProgress={showProgress}
            showDates={showDates}
          />
          {'\n'}
        </React.Fragment>
      ))}
    </>
  )
}

/** Stats - Show issue statistics */
export function StatsComponent({ showLeadTime = false }: StatsProps = {}) {
  const { total, open, in_progress, blocked, closed, percent, avgLeadTime } = globalStats

  const parts = [`**${open} open**`]
  if (in_progress > 0) parts.push(`${in_progress} in progress`)
  if (blocked > 0) parts.push(`${blocked} blocked`)
  parts.push(`${closed} closed`)
  parts.push(`${total} total (${percent}% complete)`)

  if (showLeadTime && avgLeadTime) {
    parts.push(`avg ${avgLeadTime}d lead time`)
  }

  return <Text>{parts.join(' · ')}</Text>
}

// Export as both default name and named export
export { StatsComponent as Stats }

/** Command - Define a CLI command */
export function Command({ name, description, aliases, children }: CommandProps) {
  return (
    <>
      <Text style={{ bold: true, color: 'green' }}>{name}</Text>
      {aliases && aliases.length > 0 && (
        <Text style={{ dim: true }}> (aliases: {aliases.join(', ')})</Text>
      )}
      {'\n'}
      {description && (
        <>
          <Text>  {description}</Text>
          {'\n'}
        </>
      )}
      {children}
    </>
  )
}

/** Agent - Render AI agent instructions */
export function Agent({ rules, context, children }: AgentProps) {
  return (
    <>
      {rules && rules.length > 0 && (
        <>
          <Text style={{ bold: true }}>Rules:</Text>
          {'\n'}
          {rules.map((rule, i) => (
            <React.Fragment key={i}>
              <Text>  {i + 1}. {rule}</Text>
              {'\n'}
            </React.Fragment>
          ))}
        </>
      )}
      {context && Object.keys(context).length > 0 && (
        <>
          <Text style={{ bold: true }}>Context:</Text>
          {'\n'}
          {Object.entries(context).map(([key, value]) => (
            <React.Fragment key={key}>
              <Text>  {key}: {JSON.stringify(value)}</Text>
              {'\n'}
            </React.Fragment>
          ))}
        </>
      )}
      {children}
    </>
  )
}

/** Helper: Render a single issue item */
function IssueItem({ issue }: { issue: Issue }) {
  const checkbox = getCheckbox(issue.state)
  const priority = issue.priority !== undefined ? ` [P${issue.priority}]` : ''
  const labels = issue.labels?.length ? ` (${issue.labels.join(', ')})` : ''

  return (
    <Text>
      - {checkbox} <Text style={{ bold: true }}>{issue.id}</Text>{priority}: {issue.title}
      {labels}
    </Text>
  )
}

/** Helper: Render a single milestone item */
function MilestoneItem({
  milestone,
  showProgress,
  showDates,
}: {
  milestone: Milestone
  showProgress?: boolean
  showDates?: boolean
}) {
  const { title, description, progress, dueOn, state } = milestone
  const stateIcon = state === 'open' ? '🎯' : '✅'

  return (
    <>
      <Text>
        {stateIcon} <Text style={{ bold: true }}>{title}</Text>
      </Text>
      {'\n'}
      {description && (
        <>
          <Text style={{ dim: true }}>  {description}</Text>
          {'\n'}
        </>
      )}
      {showProgress && progress && (
        <>
          <Text>
            {'  '}Progress: {progress.closed}/{progress.total} ({progress.percent}%)
          </Text>
          {'\n'}
        </>
      )}
      {showDates && dueOn && (
        <>
          <Text style={{ dim: true }}>  Due: {dueOn}</Text>
          {'\n'}
        </>
      )}
    </>
  )
}

/** Helper: Get checkbox for issue state */
function getCheckbox(state: Issue['state']): string {
  switch (state) {
    case 'closed':
      return '[x]'
    case 'in_progress':
      return '[-]'
    case 'blocked':
      return '[!]'
    default:
      return '[ ]'
  }
}
