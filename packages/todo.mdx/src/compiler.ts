/**
 * Compiler for TODO.mdx → TODO.md
 * Hydrates templates with live issue data
 */

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import type { Issue, TodoConfig } from './types.js'
import { parsePattern, DEFAULT_PATTERN } from './pattern.js'
import { parseTodoFile } from './parser.js'

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

/** Load issues from beads-workflows SDK */
async function loadBeadsIssues(): Promise<Issue[]> {
  try {
    const moduleName = 'beads-workflows'
    const sdk = await import(/* @vite-ignore */ moduleName)
    const beadsDir = await sdk.findBeadsDir(process.cwd())
    if (!beadsDir) return []

    const rawIssues = await sdk.readIssuesFromJsonl(beadsDir)
    return rawIssues.map((i: any) => {
      // Map beads status to Issue state
      let state: 'open' | 'in_progress' | 'closed' = 'open'
      if (i.status === 'closed') state = 'closed'
      else if (i.status === 'in_progress') state = 'in_progress'

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
      }
    })
  } catch {
    return []
  }
}

/** Load issues from .todo/*.md files */
async function loadFileIssues(todoDir: string, pattern: string): Promise<Issue[]> {
  if (!existsSync(todoDir)) return []

  const filePattern = parsePattern(pattern)
  const files = await readdir(todoDir)
  const issues: Issue[] = []

  for (const file of files) {
    if (!file.endsWith('.md')) continue

    const content = await readFile(join(todoDir, file), 'utf-8')
    const parsed = parseTodoFile(content)

    if (parsed.issue.title) {
      issues.push({
        id: parsed.issue.id || file.replace('.md', ''),
        title: parsed.issue.title,
        body: parsed.issue.body,
        state: parsed.issue.state || 'open',
        labels: parsed.issue.labels || [],
        priority: parsed.issue.priority,
        type: parsed.issue.type,
        githubId: parsed.issue.githubId,
        githubNumber: parsed.issue.githubNumber,
        beadsId: parsed.issue.beadsId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Issue)
    }
  }

  return issues
}

/** Compile TODO.mdx to TODO.md */
export async function compile(options: {
  input?: string
  output?: string
  todoDir?: string
  config?: TodoConfig
} = {}): Promise<string> {
  const {
    input = 'TODO.mdx',
    output = 'TODO.md',
    todoDir = '.todo',
    config = {},
  } = options

  // Read template
  let template: string
  try {
    template = await readFile(input, 'utf-8')
  } catch {
    // Use default template
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

  // Merge config from frontmatter
  const finalConfig: TodoConfig = {
    ...config,
    beads: frontmatter.beads as boolean ?? config.beads ?? true,
    filePattern: frontmatter.filePattern as string ?? config.filePattern ?? DEFAULT_PATTERN,
  }

  // Load issues from various sources
  const [beadsIssues, fileIssues] = await Promise.all([
    finalConfig.beads ? loadBeadsIssues() : [],
    loadFileIssues(todoDir, finalConfig.filePattern!),
  ])

  // Merge issues (file issues take precedence)
  const issueMap = new Map<string, Issue>()
  for (const issue of beadsIssues) {
    issueMap.set(issue.id, issue)
  }
  for (const issue of fileIssues) {
    issueMap.set(issue.id, issue)
  }
  const issues = Array.from(issueMap.values())

  // Hydrate template
  const result = hydrateTemplate(content, issues, frontmatter)

  // Write output
  await writeFile(output, result)

  return result
}

/** Hydrate template with issue data */
function hydrateTemplate(
  template: string,
  issues: Issue[],
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
  result = result.replace(/<Issues\.Open\s*\/>/g, () => {
    const open = issues.filter(i => i.state === 'open')
    return renderIssueList(open, 'Open Issues')
  })

  result = result.replace(/<Issues\.Closed\s*\/>/g, () => {
    const closed = issues.filter(i => i.state === 'closed')
    return renderIssueList(closed, 'Closed Issues')
  })

  result = result.replace(/<Issues\s*\/>/g, () => {
    return renderIssueList(issues, 'All Issues')
  })

  result = result.replace(/<Issues\.InProgress\s*\/>/g, () => {
    const inProgress = issues.filter(i => i.state === 'in_progress')
    return renderIssueList(inProgress, 'In Progress')
  })

  result = result.replace(/<Issues\.Ready(?:\s+limit=\{(\d+)\})?\s*\/>/g, (_, limit) => {
    const ready = issues.filter(i => i.state === 'open').slice(0, limit ? parseInt(limit) : 10)
    return renderIssueList(ready, 'Ready to Work')
  })

  result = result.replace(/<Stats\s*\/>/g, () => {
    return renderStats(issues)
  })

  return result
}

/** Render issue list as markdown */
function renderIssueList(issues: Issue[], _title: string): string {
  if (issues.length === 0) {
    return '_No issues_\n'
  }

  const lines: string[] = []

  for (const issue of issues) {
    let checkbox = '[ ]'
    if (issue.state === 'closed') checkbox = '[x]'
    else if (issue.state === 'in_progress') checkbox = '[-]'
    const priority = issue.priority !== undefined ? ` (P${issue.priority})` : ''
    const labels = issue.labels?.length ? ` [${issue.labels.join(', ')}]` : ''
    lines.push(`- ${checkbox} **${issue.id}**: ${issue.title}${priority}${labels}`)
  }

  lines.push('')
  return lines.join('\n')
}

/** Render stats as markdown */
function renderStats(issues: Issue[]): string {
  const open = issues.filter(i => i.state === 'open').length
  const inProgress = issues.filter(i => i.state === 'in_progress').length
  const closed = issues.filter(i => i.state === 'closed').length
  const total = issues.length
  const percent = total > 0 ? Math.round((closed / total) * 100) : 0

  const parts = [`**${open} open**`]
  if (inProgress > 0) parts.push(`${inProgress} in progress`)
  parts.push(`${closed} closed`, `${total} total (${percent}% complete)`)

  return parts.join(' · ') + '\n'
}

/** Default TODO.mdx template */
const DEFAULT_TEMPLATE = `---
title: TODO
beads: true
---

# {title}

<Stats />

## In Progress

<Issues.InProgress />

## Open Issues

<Issues.Open />

## Completed

<Issues.Closed />
`

/** Generate .todo/*.md files from issues */
export async function generateTodoFiles(options: {
  todoDir?: string
  pattern?: string
  issues?: Issue[]
} = {}): Promise<string[]> {
  const {
    todoDir = '.todo',
    pattern = DEFAULT_PATTERN,
    issues = [],
  } = options

  // Ensure directory exists
  if (!existsSync(todoDir)) {
    await mkdir(todoDir, { recursive: true })
  }

  const filePattern = parsePattern(pattern)
  const created: string[] = []

  for (const issue of issues) {
    const filename = filePattern.format(issue)
    const filepath = join(todoDir, filename)

    // Generate content
    const content = `---
id: ${issue.id}
title: "${issue.title}"
state: ${issue.state}
${issue.githubNumber ? `github_number: ${issue.githubNumber}` : ''}
${issue.beadsId ? `beads_id: ${issue.beadsId}` : ''}
${issue.priority !== undefined ? `priority: ${issue.priority}` : ''}
${issue.type ? `type: ${issue.type}` : ''}
${issue.labels?.length ? `labels: [${issue.labels.join(', ')}]` : ''}
---

# ${issue.title}

${issue.body || ''}
`

    await writeFile(filepath, content.replace(/\n{3,}/g, '\n\n'))
    created.push(filepath)
  }

  return created
}
