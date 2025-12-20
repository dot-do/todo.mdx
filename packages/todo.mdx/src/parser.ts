/**
 * Parser for .todo/*.md files
 * Extracts issue data from markdown + frontmatter
 */

import type { Issue, ParsedTodoFile } from './types.js'

/** YAML frontmatter regex */
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/** Parse YAML frontmatter (simple implementation) */
function parseYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = yaml.split('\n')

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue

    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    let value: unknown = line.slice(colonIndex + 1).trim()

    // Parse value types
    if (value === 'true') value = true
    else if (value === 'false') value = false
    else if (value === 'null' || value === '') value = null
    else if (/^\d+$/.test(value as string)) value = parseInt(value as string, 10)
    else if (/^\d+\.\d+$/.test(value as string)) value = parseFloat(value as string)
    else if ((value as string).startsWith('[') && (value as string).endsWith(']')) {
      // Simple array parsing
      value = (value as string)
        .slice(1, -1)
        .split(',')
        .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
    } else if ((value as string).startsWith('"') || (value as string).startsWith("'")) {
      value = (value as string).slice(1, -1)
    }

    result[key] = value
  }

  return result
}

/** Parse a todo markdown file */
export function parseTodoFile(content: string): ParsedTodoFile {
  let frontmatter: Record<string, unknown> = {}
  let body = content

  const match = content.match(FRONTMATTER_REGEX)
  if (match) {
    frontmatter = parseYaml(match[1])
    body = content.slice(match[0].length)
  }

  // Extract issue data from frontmatter
  const issue: Partial<Issue> = {}

  if (frontmatter.id) issue.id = String(frontmatter.id)
  if (frontmatter.github_id) issue.githubId = Number(frontmatter.github_id)
  if (frontmatter.github_number) issue.githubNumber = Number(frontmatter.github_number)
  if (frontmatter.beads_id) issue.beadsId = String(frontmatter.beads_id)
  if (frontmatter.title) issue.title = String(frontmatter.title)
  if (frontmatter.state) issue.state = frontmatter.state as Issue['state']
  if (frontmatter.labels) issue.labels = frontmatter.labels as string[]
  if (frontmatter.assignees) issue.assignees = frontmatter.assignees as string[]
  if (frontmatter.priority) issue.priority = Number(frontmatter.priority)
  if (frontmatter.type) issue.type = frontmatter.type as Issue['type']
  if (frontmatter.milestone) issue.milestone = String(frontmatter.milestone)

  // Body is the description
  issue.body = body.trim()

  // Try to extract title from first H1 if not in frontmatter
  if (!issue.title) {
    const h1Match = body.match(/^#\s+(.+)$/m)
    if (h1Match) {
      issue.title = h1Match[1].trim()
      // Remove H1 from body
      issue.body = body.replace(/^#\s+.+\r?\n?/, '').trim()
    }
  }

  return {
    frontmatter,
    content: body,
    issue,
  }
}

/** Extract all checkbox items from markdown */
export function extractTasks(content: string): Array<{ checked: boolean; text: string }> {
  const tasks: Array<{ checked: boolean; text: string }> = []
  const taskRegex = /^[-*]\s+\[([ xX])\]\s+(.+)$/gm

  let match
  while ((match = taskRegex.exec(content)) !== null) {
    tasks.push({
      checked: match[1].toLowerCase() === 'x',
      text: match[2].trim(),
    })
  }

  return tasks
}

/** Calculate completion percentage from tasks */
export function calculateProgress(content: string): { total: number; completed: number; percent: number } {
  const tasks = extractTasks(content)
  const total = tasks.length
  const completed = tasks.filter(t => t.checked).length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  return { total, completed, percent }
}
