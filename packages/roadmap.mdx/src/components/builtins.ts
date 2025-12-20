/**
 * Built-in components for ROADMAP.mdx
 *
 * These components render milestone and epic data using @mdxld/markdown conventions.
 */

import { registerComponent } from './registry.js'
import { toMarkdown } from '@mdxld/markdown'
import type { Milestone, Epic, ComponentProps } from '../types.js'

// Data will be injected by the compiler
let _milestones: Milestone[] = []
let _epics: Epic[] = []
let _issues: Array<{ id: string; title: string; state: string; milestoneId?: string }> = []

export function setData(data: {
  milestones?: Milestone[]
  epics?: Epic[]
  issues?: Array<{ id: string; title: string; state: string; milestoneId?: string }>
}) {
  _milestones = data.milestones || []
  _epics = data.epics || []
  _issues = data.issues || []
}

/**
 * <Milestones /> - Render all milestones
 */
registerComponent('Milestones', (props: ComponentProps) => {
  const milestones = _milestones
  if (milestones.length === 0) return '_No milestones_\n'

  return toMarkdown({
    sections: milestones.map(m => {
      const mIssues = _issues.filter(i => i.milestoneId === m.id)
      const issueList = mIssues.length > 0
        ? mIssues.map(i => `[${i.state === 'closed' ? 'x' : ' '}] ${i.title}`).join('\n- ')
        : '_No issues_'

      return {
        name: `${m.title} ${m.state === 'closed' ? '✓' : `(${m.progress.percent}%)`}`,
        content: (m.dueOn ? `Due: ${m.dueOn}\n\n` : '') + (mIssues.length > 0 ? `- ${issueList}` : issueList),
      }
    }),
  }, { headingDepth: 2 })
}, 'Render all milestones with progress')

/**
 * <Milestones.Open /> - Render open milestones only
 */
registerComponent('Milestones.Open', (props: ComponentProps) => {
  const open = _milestones.filter(m => m.state === 'open')
  if (open.length === 0) return '_No open milestones_\n'

  return toMarkdown({
    sections: open.map(m => {
      const mIssues = _issues.filter(i => i.milestoneId === m.id)
      const issueList = mIssues.length > 0
        ? mIssues.map(i => `[${i.state === 'closed' ? 'x' : ' '}] ${i.title}`).join('\n- ')
        : '_No issues_'

      return {
        name: `${m.title} (${m.progress.percent}%)`,
        content: (m.dueOn ? `Due: ${m.dueOn}\n\n` : '') + (mIssues.length > 0 ? `- ${issueList}` : issueList),
      }
    }),
  }, { headingDepth: 2 })
}, 'Render open milestones only')

/**
 * <Epics /> - Render all epics
 */
registerComponent('Epics', (props: ComponentProps) => {
  const epics = _epics
  if (epics.length === 0) return '_No epics_\n'

  return toMarkdown({
    items: epics.map(e => {
      const status = e.status === 'closed' ? '✓' : e.status === 'in_progress' ? '→' : '○'
      return `${status} **${e.title}** - ${e.progress.percent}% (${e.progress.completed}/${e.progress.total})`
    }),
  })
}, 'Render all epics as list')

/**
 * <Epics.Active /> - Render active (non-closed) epics
 */
registerComponent('Epics.Active', (props: ComponentProps) => {
  const active = _epics.filter(e => e.status !== 'closed')
  if (active.length === 0) return '_No active epics_\n'

  return toMarkdown({
    items: active.map(e => {
      const status = e.status === 'in_progress' ? '→' : '○'
      return `${status} **${e.title}** - ${e.progress.percent}% (${e.progress.completed}/${e.progress.total})`
    }),
  })
}, 'Render active epics only')

/**
 * <Stats /> - Render roadmap statistics
 */
registerComponent('Stats', (props: ComponentProps) => {
  const openMilestones = _milestones.filter(m => m.state === 'open').length
  const activeEpics = _epics.filter(e => e.status !== 'closed').length
  const completedEpics = _epics.filter(e => e.status === 'closed').length
  const closedIssues = _issues.filter(i => i.state === 'closed').length
  const totalIssues = _issues.length

  const parts = []
  if (totalIssues > 0) parts.push(`${closedIssues}/${totalIssues} complete`)
  if (openMilestones > 0) parts.push(`${openMilestones} milestone${openMilestones !== 1 ? 's' : ''}`)
  if (activeEpics > 0) parts.push(`${activeEpics} active epic${activeEpics !== 1 ? 's' : ''}`)
  if (completedEpics > 0) parts.push(`${completedEpics} completed`)

  return `**${parts.join(' · ')}**\n`
}, 'Render roadmap statistics')

/**
 * <Roadmap /> - Render full roadmap (name, description, sections)
 */
registerComponent('Roadmap', (props: ComponentProps) => {
  const closedIssues = _issues.filter(i => i.state === 'closed').length
  const openMilestones = _milestones.filter(m => m.state === 'open').length
  const backlog = _issues.filter(i => !i.milestoneId)

  const sections = _milestones.map(m => {
    const mIssues = _issues.filter(i => i.milestoneId === m.id)
    const mClosed = mIssues.filter(i => i.state === 'closed').length
    const pct = mIssues.length ? Math.round((mClosed / mIssues.length) * 100) : 0
    const issueList = mIssues.length > 0
      ? mIssues.map(i => `[${i.state === 'closed' ? 'x' : ' '}] ${i.title}`).join('\n- ')
      : '_No issues_'

    return {
      name: m.state === 'closed' ? `${m.title} ✓` : `${m.title} (${pct}%)`,
      content: (m.dueOn ? `Due: ${m.dueOn}\n\n` : '') + (mIssues.length > 0 ? `- ${issueList}` : issueList),
    }
  })

  if (backlog.length > 0) {
    sections.push({
      name: 'Backlog',
      content: '- ' + backlog.map(i => `[${i.state === 'closed' ? 'x' : ' '}] ${i.title}`).join('\n- '),
    })
  }

  return toMarkdown({
    name: (props.title as string) || 'Roadmap',
    description: `${closedIssues}/${_issues.length} complete · ${openMilestones} milestones`,
    sections,
  })
}, 'Render full roadmap with all data')
