/**
 * Compiler for ROADMAP.mdx → ROADMAP.md
 * Hydrates templates with live milestone and project data
 */

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import type { Milestone, Epic, RoadmapConfig } from './types.js'
import { getComponent, setData } from './components/index.js'
import { toMarkdown } from '@mdxld/markdown'
import { parseRoadmapFile, calculateProgress } from './parser.js'
import { extractFrontmatter } from '@todo.mdx/shared/yaml'

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

/** Load milestones from .roadmap/*.md files */
async function loadFileMilestones(roadmapDir: string): Promise<Milestone[]> {
  if (!existsSync(roadmapDir)) return []

  const files = await readdir(roadmapDir)
  const milestones: Milestone[] = []

  for (const file of files) {
    if (!file.endsWith('.md')) continue

    const content = await readFile(join(roadmapDir, file), 'utf-8')
    const parsed = parseRoadmapFile(content)
    const progress = calculateProgress(content)

    if (parsed.milestone.title) {
      const now = new Date().toISOString()
      milestones.push({
        id: parsed.milestone.id || file.replace('.md', ''),
        githubId: parsed.milestone.githubId,
        githubNumber: parsed.milestone.githubNumber,
        beadsId: parsed.milestone.beadsId,
        title: parsed.milestone.title,
        description: parsed.milestone.description,
        state: parsed.milestone.state || 'open',
        dueOn: parsed.milestone.dueOn,
        progress,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  return milestones
}

/** Load milestones from GitHub API (requires GITHUB_TOKEN) */
async function loadGitHubMilestones(config: RoadmapConfig): Promise<Milestone[]> {
  const { owner, repo } = config
  if (!owner || !repo) return []

  const token = process.env.GITHUB_TOKEN
  if (!token) return []

  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/milestones?state=all`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'roadmap.mdx',
        },
      }
    )

    if (!response.ok) return []

    const data = await response.json() as Array<{
      id: number
      number: number
      title: string
      description: string | null
      state: 'open' | 'closed'
      due_on: string | null
      open_issues: number
      closed_issues: number
      created_at: string
      updated_at: string
    }>

    return data.map(m => {
      const total = m.open_issues + m.closed_issues
      return {
        id: `github-${m.number}`,
        githubId: m.id,
        githubNumber: m.number,
        title: m.title,
        description: m.description || undefined,
        state: m.state,
        dueOn: m.due_on || undefined,
        progress: {
          open: m.open_issues,
          closed: m.closed_issues,
          percent: total > 0 ? Math.round((m.closed_issues / total) * 100) : 0,
        },
        createdAt: m.created_at,
        updatedAt: m.updated_at,
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
  const { frontmatter, content } = extractFrontmatter(template)

  // Merge config from frontmatter
  const finalConfig: RoadmapConfig = {
    ...config,
    beads: frontmatter.beads as boolean ?? config.beads ?? true,
    owner: frontmatter.owner as string ?? config.owner,
    repo: frontmatter.repo as string ?? config.repo,
  }

  // Load data from multiple sources
  const [epics, fileMilestones, githubMilestones] = await Promise.all([
    finalConfig.beads ? loadBeadsEpics() : [],
    loadFileMilestones(roadmapDir),
    loadGitHubMilestones(finalConfig),
  ])

  // Merge milestones (file takes precedence, then GitHub)
  const milestoneMap = new Map<string, Milestone>()
  for (const m of githubMilestones) {
    milestoneMap.set(m.id, m)
    if (m.githubNumber) milestoneMap.set(`github-${m.githubNumber}`, m)
  }
  for (const m of fileMilestones) {
    milestoneMap.set(m.id, m)
    if (m.githubNumber) milestoneMap.set(`github-${m.githubNumber}`, m)
  }
  const milestones = Array.from(milestoneMap.values())

  // Issues are loaded from beads if available
  const issues: Array<{ id: string; title: string; state: string; milestoneId?: string }> = []

  // Set data for components
  setData({ milestones, epics, issues })

  // Hydrate template
  const result = await hydrateTemplate(content, frontmatter)

  // Write output
  await writeFile(output, result)

  return result
}

/** Hydrate template with component data */
async function hydrateTemplate(
  template: string,
  frontmatter: Record<string, unknown>
): Promise<string> {
  let result = template

  // Replace {variable} placeholders
  result = result.replace(/\{(\w+)\}/g, (_, key) => {
    if (frontmatter[key] !== undefined) {
      return String(frontmatter[key])
    }
    return `{${key}}`
  })

  // Find and render all components: <ComponentName /> or <Component.Sub />
  const componentRegex = /<([A-Z][a-zA-Z0-9]*(?:\.[A-Z][a-zA-Z0-9]*)?)\s*([^>]*?)\s*\/>/g

  const matches: Array<{ match: string; name: string; propsStr: string }> = []
  let m: RegExpExecArray | null
  while ((m = componentRegex.exec(result)) !== null) {
    matches.push({
      match: m[0],
      name: m[1],
      propsStr: m[2],
    })
  }

  // Process in reverse to preserve indices
  for (const { match: fullMatch, name, propsStr } of matches.reverse()) {
    const component = getComponent(name)
    if (component) {
      const props = parseProps(propsStr, frontmatter)
      const rendered = await Promise.resolve(component.render(props))
      result = result.replace(fullMatch, rendered)
    }
  }

  return result
}

/** Parse component props from string */
function parseProps(
  propsStr: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  const props: Record<string, unknown> = {}

  if (!propsStr.trim()) return props

  // Match prop="value" or prop={expression}
  const propRegex = /(\w+)=(?:"([^"]*)"|{([^}]*)})/g
  let match: RegExpExecArray | null

  while ((match = propRegex.exec(propsStr)) !== null) {
    const [, name, stringValue, exprValue] = match

    if (stringValue !== undefined) {
      props[name] = stringValue
    } else if (exprValue !== undefined) {
      const trimmed = exprValue.trim()
      if (/^\d+$/.test(trimmed)) {
        props[name] = parseInt(trimmed, 10)
      } else if (trimmed in data) {
        props[name] = data[trimmed]
      } else {
        props[name] = trimmed
      }
    }
  }

  return props
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

/** Render roadmap data to markdown using toMarkdown conventions */
export function render(data: {
  milestones?: Milestone[]
  epics?: Epic[]
  issues?: Array<{ id: string; title: string; state: string; milestoneId?: string }>
  title?: string
}): string {
  const { milestones = [], epics = [], issues = [], title = 'Roadmap' } = data

  const closedIssues = issues.filter(i => i.state === 'closed').length
  const openMilestones = milestones.filter(m => m.state === 'open').length
  const backlog = issues.filter(i => !i.milestoneId)

  const sections = milestones.map(m => {
    const mIssues = issues.filter(i => i.milestoneId === m.id)
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
    name: title,
    description: `${closedIssues}/${issues.length} complete · ${openMilestones} milestones`,
    sections,
  })
}

/** Slugify a string for use in filenames */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

/** Generate .roadmap/*.md files from milestones */
export async function generateRoadmapFiles(options: {
  roadmapDir?: string
  milestones?: Milestone[]
} = {}): Promise<string[]> {
  const {
    roadmapDir = '.roadmap',
    milestones = [],
  } = options

  // Ensure directory exists
  if (!existsSync(roadmapDir)) {
    await mkdir(roadmapDir, { recursive: true })
  }

  const created: string[] = []

  for (const milestone of milestones) {
    const filename = `${slugify(milestone.title)}.md`
    const filepath = join(roadmapDir, filename)

    // Generate content
    const content = `---
id: ${milestone.id}
title: "${milestone.title}"
state: ${milestone.state}
${milestone.githubNumber ? `github_number: ${milestone.githubNumber}` : ''}
${milestone.beadsId ? `beads_id: ${milestone.beadsId}` : ''}
${milestone.dueOn ? `due_on: ${milestone.dueOn}` : ''}
---

# ${milestone.title}

${milestone.description || ''}
`

    await writeFile(filepath, content.replace(/\n{3,}/g, '\n\n'))
    created.push(filepath)
  }

  return created
}

/** Render roadmap from beads data for MCP/API use */
export async function renderRoadmap(): Promise<string> {
  const epics = await loadBeadsEpics()

  if (epics.length === 0) {
    return '# Roadmap\n\n_No epics found_\n'
  }

  const activeEpics = epics.filter(e => e.status !== 'closed')
  const completedEpics = epics.filter(e => e.status === 'closed')

  let markdown = '# Roadmap\n\n'

  if (activeEpics.length > 0) {
    markdown += '## Active Epics\n\n'
    for (const epic of activeEpics) {
      const status = epic.status === 'in_progress' ? '→' : '○'
      markdown += `- ${status} **${epic.title}** - ${epic.progress.percent}% (${epic.progress.completed}/${epic.progress.total})\n`
    }
    markdown += '\n'
  }

  if (completedEpics.length > 0) {
    markdown += '## Completed\n\n'
    for (const epic of completedEpics) {
      markdown += `- ✓ **${epic.title}**\n`
    }
    markdown += '\n'
  }

  return markdown
}
