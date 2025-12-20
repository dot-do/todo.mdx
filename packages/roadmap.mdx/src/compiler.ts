/**
 * Compiler for ROADMAP.mdx → ROADMAP.md
 * Hydrates templates with live milestone and project data
 */

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import type { Milestone, Epic, RoadmapConfig } from './types.js'

/** Frontmatter regex */
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/** Simple YAML parser */
function parseYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const line of yaml.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue
    const key = line.slice(0, colonIndex).trim()
    let value: unknown = line.slice(colonIndex + 1).trim()
    if (value === 'true') value = true
    else if (value === 'false') value = false
    else if (/^\d+$/.test(value as string)) value = parseInt(value as string, 10)
    result[key] = value
  }
  return result
}

/** Load epics from beads-workflows SDK */
async function loadBeadsEpics(): Promise<Epic[]> {
  try {
    const moduleName = 'beads-workflows'
    const sdk = await import(/* @vite-ignore */ moduleName)
    const beadsDir = await sdk.findBeadsDir(process.cwd())
    if (!beadsDir) return []

    const rawIssues = await sdk.readIssuesFromJsonl(beadsDir)
    const epics = rawIssues.filter((i: any) => i.type === 'epic')

    return epics.map((e: any) => {
      const children = rawIssues.filter((i: any) => i.epic === e.id)
      const completed = children.filter((i: any) => i.status === 'closed').length

      return {
        id: e.id,
        beadsId: e.id,
        title: e.title,
        description: e.description,
        status: e.status,
        children: children.map((c: any) => c.id),
        progress: {
          total: children.length,
          completed,
          percent: children.length > 0 ? Math.round((completed / children.length) * 100) : 0,
        },
        createdAt: e.created?.toISOString() || new Date().toISOString(),
        updatedAt: e.updated?.toISOString() || new Date().toISOString(),
      }
    })
  } catch {
    return []
  }
}

/** Compile ROADMAP.mdx to ROADMAP.md */
export async function compile(options: {
  input?: string
  output?: string
  roadmapDir?: string
  config?: RoadmapConfig
} = {}): Promise<string> {
  const {
    input = 'ROADMAP.mdx',
    output = 'ROADMAP.md',
    roadmapDir = '.roadmap',
    config = {},
  } = options

  // Read template
  let template: string
  try {
    template = await readFile(input, 'utf-8')
  } catch {
    template = DEFAULT_TEMPLATE
  }

  // Parse frontmatter
  let frontmatter: Record<string, unknown> = {}
  let content = template

  const match = template.match(FRONTMATTER_REGEX)
  if (match) {
    frontmatter = parseYaml(match[1])
    content = template.slice(match[0].length)
  }

  // Merge config
  const finalConfig: RoadmapConfig = {
    ...config,
    beads: frontmatter.beads as boolean ?? config.beads ?? true,
  }

  // Load data
  const epics = finalConfig.beads ? await loadBeadsEpics() : []

  // Hydrate template
  const result = hydrateTemplate(content, [], epics, frontmatter)

  // Write output
  await writeFile(output, result)

  return result
}

/** Hydrate template with milestone/epic data */
function hydrateTemplate(
  template: string,
  milestones: Milestone[],
  epics: Epic[],
  frontmatter: Record<string, unknown>
): string {
  let result = template

  // Replace {variable} placeholders
  result = result.replace(/\{(\w+)\}/g, (_, key) => {
    if (frontmatter[key] !== undefined) {
      return String(frontmatter[key])
    }
    return `{${key}}`
  })

  // Replace component tags
  result = result.replace(/<Milestones\s*\/>/g, () => {
    return renderMilestoneList(milestones)
  })

  result = result.replace(/<Milestones\.Open\s*\/>/g, () => {
    const open = milestones.filter(m => m.state === 'open')
    return renderMilestoneList(open)
  })

  result = result.replace(/<Epics\s*\/>/g, () => {
    return renderEpicList(epics)
  })

  result = result.replace(/<Epics\.Active\s*\/>/g, () => {
    const active = epics.filter(e => e.status !== 'closed')
    return renderEpicList(active)
  })

  result = result.replace(/<Stats\s*\/>/g, () => {
    return renderStats(milestones, epics)
  })

  return result
}

/** Render milestone list */
function renderMilestoneList(milestones: Milestone[]): string {
  if (milestones.length === 0) {
    return '_No milestones_\n'
  }

  const lines: string[] = []

  for (const m of milestones) {
    const dueDate = m.dueOn ? ` (due ${m.dueOn})` : ''
    const progress = `${m.progress.percent}%`
    lines.push(`### ${m.title}${dueDate}`)
    lines.push('')
    lines.push(`Progress: ${progress} (${m.progress.closed}/${m.progress.open + m.progress.closed} issues)`)
    if (m.description) {
      lines.push('')
      lines.push(m.description)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/** Render epic list */
function renderEpicList(epics: Epic[]): string {
  if (epics.length === 0) {
    return '_No epics_\n'
  }

  const lines: string[] = []

  for (const e of epics) {
    const status = e.status === 'closed' ? '✓' : e.status === 'in_progress' ? '→' : '○'
    const progress = `${e.progress.percent}%`
    lines.push(`- ${status} **${e.title}** - ${progress} (${e.progress.completed}/${e.progress.total})`)
  }

  lines.push('')
  return lines.join('\n')
}

/** Render stats */
function renderStats(milestones: Milestone[], epics: Epic[]): string {
  const openMilestones = milestones.filter(m => m.state === 'open').length
  const activeEpics = epics.filter(e => e.status !== 'closed').length
  const completedEpics = epics.filter(e => e.status === 'closed').length

  return `**${openMilestones} open milestones** · **${activeEpics} active epics** · ${completedEpics} completed epics\n`
}

/** Default ROADMAP.mdx template */
const DEFAULT_TEMPLATE = `---
title: Roadmap
---

# {title}

<Stats />

## Active Epics

<Epics.Active />

## Milestones

<Milestones.Open />
`

/** Render roadmap data to markdown */
export function render(data: {
  milestones?: Milestone[]
  epics?: Epic[]
  issues?: Array<{ id: string; title: string; state: string; milestoneId?: string }>
  title?: string
}): string {
  const { milestones = [], epics = [], issues = [], title = 'Roadmap' } = data

  const lines: string[] = [`# ${title}`, '']

  // Stats
  const openMilestones = milestones.filter(m => m.state === 'open').length
  const activeEpics = epics.filter(e => e.status !== 'closed').length
  const openIssues = issues.filter(i => i.state === 'open').length
  const closedIssues = issues.filter(i => i.state === 'closed').length

  lines.push(`${closedIssues}/${issues.length} complete · ${openMilestones} milestones · ${activeEpics} epics`, '')

  // Milestones with issues
  for (const m of milestones) {
    const mIssues = issues.filter(i => i.milestoneId === m.id)
    const closed = mIssues.filter(i => i.state === 'closed').length
    const pct = mIssues.length ? Math.round((closed / mIssues.length) * 100) : 0

    lines.push(`## ${m.title} ${m.state === 'closed' ? '✓' : `(${pct}%)`}`)
    if (m.dueOn) lines.push(`Due: ${m.dueOn}`)
    lines.push('')

    for (const issue of mIssues) {
      lines.push(`- [${issue.state === 'closed' ? 'x' : ' '}] ${issue.title}`)
    }
    lines.push('')
  }

  // Backlog (unassigned)
  const backlog = issues.filter(i => !i.milestoneId)
  if (backlog.length) {
    lines.push('## Backlog', '')
    for (const issue of backlog) {
      lines.push(`- [${issue.state === 'closed' ? 'x' : ' '}] ${issue.title}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
