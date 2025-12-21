/**
 * Parser for .todo/*.md files
 * Extracts issue data from markdown + frontmatter
 */

import type { Issue, ParsedTodoFile } from './types.js'
import { extractFrontmatter } from '@todo.mdx/shared/yaml'

/** Parse a todo markdown file */
export function parseTodoFile(content: string): ParsedTodoFile {
  const { frontmatter, content: body } = extractFrontmatter(content)

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
