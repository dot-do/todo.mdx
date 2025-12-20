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

/** Simple YAML parser with array support */
function parseYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = yaml.split('\n')
  let currentKey: string | null = null
  let currentArray: string[] | null = null

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue

    // Check for array item (starts with -)
    if (line.trim().startsWith('- ') && currentKey && currentArray) {
      currentArray.push(line.trim().slice(2).trim())
      continue
    }

    // Save previous array if we're moving to a new key
    if (currentKey && currentArray) {
      result[currentKey] = currentArray
      currentKey = null
      currentArray = null
    }

    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    let value: unknown = line.slice(colonIndex + 1).trim()

    // Check if this starts an array (empty after colon, or explicit [])
    if (value === '' || value === '[]') {
      currentKey = key
      currentArray = []
      continue
    }

    // Inline array: [item1, item2]
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
      result[key] = value
      continue
    }

    // Scalar values
    if (value === 'true') value = true
    else if (value === 'false') value = false
    else if (/^\d+$/.test(value as string)) value = parseInt(value as string, 10)
    result[key] = value
  }

  // Save final array if any
  if (currentKey && currentArray) {
    result[currentKey] = currentArray
  }

  return result
}

/** Load issues from beads-workflows SDK */
export async function loadBeadsIssues(): Promise<Issue[]> {
  try {
    const moduleName = 'beads-workflows'
    const sdk = await import(/* @vite-ignore */ moduleName)
    const beadsDir = await sdk.findBeadsDir(process.cwd())
    if (!beadsDir) return []

    const rawIssues = await sdk.readIssuesFromJsonl(beadsDir)

    return rawIssues.map((i: any) => {
      // Map beads status to Issue state
      let state: 'open' | 'in_progress' | 'closed' | 'blocked' = 'open'
      if (i.status === 'closed') state = 'closed'
      else if (i.status === 'blocked') state = 'blocked'
      else if (i.status === 'in_progress') state = 'in_progress'

      return {
        id: i.id,
        beadsId: i.id,
        title: i.title,
        body: i.description,
        state,
        labels: i.labels || [],
        priority: i.priority,
        type: i.issue_type || i.type || 'task',
        createdAt: i.created_at?.toISOString?.() || i.created_at || new Date().toISOString(),
        updatedAt: i.updated_at?.toISOString?.() || i.updated_at || new Date().toISOString(),
        blockedBy: i.blocked_by || [],
        blocks: i.blocks || [],
        epicId: i.epic_id,
        assignees: i.assignee ? [i.assignee] : [],
      } as Issue
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
  templateDir?: string
  config?: TodoConfig
} = {}): Promise<{ mainOutput: string; generatedFiles: string[] }> {
  const {
    input = 'TODO.mdx',
    output = 'TODO.md',
    todoDir = '.todo',
    templateDir = '.mdx',
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

  // Parse outputs array from frontmatter
  const outputs = frontmatter.outputs as string[] ?? [output]

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

  // Track generated files
  const generatedFiles: string[] = []

  // Process each output target
  for (const outputTarget of outputs) {
    // Check if this is a glob pattern for individual issue files
    if (outputTarget.includes('*.md') || outputTarget.includes('*.mdx')) {
      // Extract directory from pattern (e.g., ".todo/*.md" -> ".todo")
      const outputDir = dirname(outputTarget) || todoDir
      const generated = await generateTodoFiles({
        todoDir: outputDir,
        pattern: finalConfig.filePattern,
        issues,
        templateDir,
      })
      generatedFiles.push(...generated)
    } else {
      // Single file output (e.g., "TODO.md")
      await writeFile(outputTarget, result)
      generatedFiles.push(outputTarget)
    }
  }

  return { mainOutput: result, generatedFiles }
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
    // Ready = open and not blocked (no blockedBy dependencies)
    const ready = issues.filter(i =>
      i.state === 'open' && (!i.blockedBy || i.blockedBy.length === 0)
    ).slice(0, limit ? parseInt(limit) : 10)
    return renderIssueList(ready, 'Ready to Work')
  })

  result = result.replace(/<Issues\.Blocked\s*\/>/g, () => {
    // Include issues with blocked state or blockedBy dependencies
    const blocked = issues.filter(i =>
      i.state === 'blocked' ||
      (i.state === 'open' && i.blockedBy && i.blockedBy.length > 0)
    )
    return renderIssueList(blocked, 'Blocked')
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

/** Default issue template */
const DEFAULT_ISSUE_TEMPLATE = `---
id: {id}
title: "{title}"
state: {state}
priority: {priority}
type: {type}
labels: [{labels}]
---

# {title}

{body}
`

/** Load issue template from .mdx directory */
async function loadIssueTemplate(templateDir: string): Promise<string | null> {
  // Try type-specific templates first, then generic
  const templatePaths = [
    join(templateDir, 'issue.mdx'),
  ]

  for (const templatePath of templatePaths) {
    if (existsSync(templatePath)) {
      return readFile(templatePath, 'utf-8')
    }
  }

  return null
}

/** Get type-specific issue template if available */
async function getIssueTemplate(templateDir: string, issueType: string): Promise<string> {
  // Try type-specific template first
  const typeTemplatePath = join(templateDir, `issue-${issueType}.mdx`)
  if (existsSync(typeTemplatePath)) {
    return readFile(typeTemplatePath, 'utf-8')
  }

  // Try generic template
  const genericTemplatePath = join(templateDir, 'issue.mdx')
  if (existsSync(genericTemplatePath)) {
    return readFile(genericTemplatePath, 'utf-8')
  }

  // Use default
  return DEFAULT_ISSUE_TEMPLATE
}

/** Hydrate issue template with issue data and components */
function hydrateIssueTemplate(
  template: string,
  issue: Issue,
  allIssues: Issue[] = []
): string {
  let result = template

  // Use placeholder to protect component-like syntax in body from processing
  // We'll restore them after component processing
  const PLACEHOLDER_PREFIX = '__ESCAPED_COMPONENT_'
  const escapedBody = (issue.body ?? '')
    .replace(/<(Subtasks|RelatedIssues|Progress|Timeline|Discussion)\s*\/>/g,
      (_, name) => `${PLACEHOLDER_PREFIX}${name}__`)

  // Replace placeholders
  result = result.replace(/\{id\}/g, issue.id)
  result = result.replace(/\{title\}/g, issue.title.replace(/"/g, '\\"'))
  result = result.replace(/\{state\}/g, issue.state)
  result = result.replace(/\{priority\}/g, issue.priority?.toString() ?? '2')
  result = result.replace(/\{type\}/g, issue.type ?? 'task')
  result = result.replace(/\{labels\}/g, issue.labels?.join(', ') ?? '')
  result = result.replace(/\{body\}/g, escapedBody)
  result = result.replace(/\{beadsId\}/g, issue.beadsId ?? '')
  result = result.replace(/\{githubNumber\}/g, issue.githubNumber?.toString() ?? '')
  result = result.replace(/\{createdAt\}/g, issue.createdAt ?? '')
  result = result.replace(/\{updatedAt\}/g, issue.updatedAt ?? '')

  // Render issue-specific components

  // <Subtasks /> - child issues for epics
  result = result.replace(/<Subtasks\s*\/>/g, () => {
    const children = allIssues.filter(i => i.epicId === issue.id)
    if (children.length === 0) return ''

    const lines = ['### Subtasks', '']
    for (const child of children) {
      const checkbox = child.state === 'closed' ? '[x]' : child.state === 'in_progress' ? '[-]' : '[ ]'
      lines.push(`- ${checkbox} **${child.id}**: ${child.title}`)
    }
    return lines.join('\n') + '\n'
  })

  // <RelatedIssues /> - linked/blocking issues
  result = result.replace(/<RelatedIssues\s*\/>/g, () => {
    const blocks = issue.blocks || []
    const blockedBy = issue.blockedBy || []
    if (blocks.length === 0 && blockedBy.length === 0) return ''

    const lines = ['### Related Issues', '']

    if (blockedBy.length > 0) {
      lines.push('**Blocked by:**')
      for (const depId of blockedBy) {
        const dep = allIssues.find(i => i.id === depId)
        if (dep) {
          const status = dep.state === 'closed' ? '✓' : '○'
          lines.push(`- ${status} **${dep.id}**: ${dep.title}`)
        } else {
          lines.push(`- ○ **${depId}**`)
        }
      }
      lines.push('')
    }

    if (blocks.length > 0) {
      lines.push('**Blocks:**')
      for (const depId of blocks) {
        const dep = allIssues.find(i => i.id === depId)
        if (dep) {
          lines.push(`- **${dep.id}**: ${dep.title}`)
        } else {
          lines.push(`- **${depId}**`)
        }
      }
      lines.push('')
    }

    return lines.join('\n')
  })

  // <Progress /> - completion metrics for epics
  result = result.replace(/<Progress\s*\/>/g, () => {
    const children = allIssues.filter(i => i.epicId === issue.id)
    if (children.length === 0) return ''

    const total = children.length
    const completed = children.filter(i => i.state === 'closed').length
    const inProgress = children.filter(i => i.state === 'in_progress').length
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0

    const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5))
    return `**Progress:** ${bar} ${percent}% (${completed}/${total} complete, ${inProgress} in progress)\n`
  })

  // <Timeline /> - creation/update history
  result = result.replace(/<Timeline\s*\/>/g, () => {
    const lines = ['### Timeline', '']
    if (issue.createdAt) {
      lines.push(`- **Created:** ${new Date(issue.createdAt).toLocaleDateString()}`)
    }
    if (issue.updatedAt && issue.updatedAt !== issue.createdAt) {
      lines.push(`- **Updated:** ${new Date(issue.updatedAt).toLocaleDateString()}`)
    }
    return lines.join('\n') + '\n'
  })

  // Restore escaped components in body as code blocks
  result = result.replace(/__ESCAPED_COMPONENT_(Subtasks|RelatedIssues|Progress|Timeline|Discussion)__/g,
    (_, name) => `\`<${name} />\``)

  // Clean up empty lines from conditional fields
  result = result.replace(/\n{3,}/g, '\n\n')

  return result
}

/** Generate .todo/*.md files from issues */
export async function generateTodoFiles(options: {
  todoDir?: string
  pattern?: string
  issues?: Issue[]
  templateDir?: string
} = {}): Promise<string[]> {
  const {
    todoDir = '.todo',
    pattern = DEFAULT_PATTERN,
    issues: providedIssues,
    templateDir = '.mdx',
  } = options

  // Load issues if not provided
  const issues = providedIssues ?? await loadBeadsIssues()

  // Ensure directory exists
  if (!existsSync(todoDir)) {
    await mkdir(todoDir, { recursive: true })
  }

  const filePattern = parsePattern(pattern)
  const created: string[] = []

  // Check for issue template
  const issueTemplate = await loadIssueTemplate(templateDir)

  for (const issue of issues) {
    const filename = filePattern.format(issue)
    const filepath = join(todoDir, filename)

    // Get template (type-specific or generic)
    const template = await getIssueTemplate(templateDir, issue.type ?? 'task')

    // Generate content using template (pass allIssues for component rendering)
    const content = hydrateIssueTemplate(template, issue, issues)

    await writeFile(filepath, content)
    created.push(filepath)
  }

  return created
}
