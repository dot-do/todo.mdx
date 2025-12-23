/**
 * Parser for .todo/*.md files
 * Extracts YAML frontmatter and markdown content to create TodoIssue objects
 */

import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import type { ParsedTodoFile, TodoIssue } from './types.js'

/**
 * Parse YAML frontmatter from markdown content
 * Simple parser that handles the --- delimited format
 */
function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/
  const match = content.match(frontmatterRegex)

  if (!match) {
    return { frontmatter: {}, body: content }
  }

  const [, frontmatterStr, body] = match
  const frontmatter: Record<string, unknown> = {}

  // Parse YAML-like frontmatter line by line
  const lines = frontmatterStr.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) continue

    const key = trimmed.slice(0, colonIndex).trim()
    let value: unknown = trimmed.slice(colonIndex + 1).trim()

    // Parse basic types
    if (value === 'true') value = true
    else if (value === 'false') value = false
    else if (value === 'null') value = null
    else if (/^\d+$/.test(value as string)) value = parseInt(value as string, 10)
    else if (/^\d+\.\d+$/.test(value as string)) value = parseFloat(value as string)
    else if ((value as string).startsWith('"') && (value as string).endsWith('"')) {
      value = (value as string).slice(1, -1)
    } else if ((value as string).startsWith("'") && (value as string).endsWith("'")) {
      value = (value as string).slice(1, -1)
    } else if ((value as string).startsWith('[') && (value as string).endsWith(']')) {
      // Parse arrays
      const arrayContent = (value as string).slice(1, -1)
      value = arrayContent.split(',').map(item => {
        const trimmedItem = item.trim()
        if (trimmedItem.startsWith('"') && trimmedItem.endsWith('"')) {
          return trimmedItem.slice(1, -1)
        }
        if (trimmedItem.startsWith("'") && trimmedItem.endsWith("'")) {
          return trimmedItem.slice(1, -1)
        }
        return trimmedItem
      }).filter(Boolean)
    }

    frontmatter[key] = value
  }

  return { frontmatter, body: body.trim() }
}

/**
 * Map frontmatter state to TodoIssue status
 */
function mapStateToStatus(state: unknown): 'open' | 'in_progress' | 'closed' {
  if (typeof state !== 'string') return 'open'

  const normalized = state.toLowerCase()
  if (normalized === 'closed' || normalized === 'done' || normalized === 'completed') {
    return 'closed'
  }
  if (normalized === 'in_progress' || normalized === 'in-progress' || normalized === 'working') {
    return 'in_progress'
  }
  return 'open'
}

/**
 * Normalize issue type
 */
function normalizeType(type: unknown): 'task' | 'bug' | 'feature' | 'epic' {
  if (typeof type !== 'string') return 'task'

  const normalized = type.toLowerCase()
  if (normalized === 'bug') return 'bug'
  if (normalized === 'feature') return 'feature'
  if (normalized === 'epic') return 'epic'
  return 'task'
}

/**
 * Normalize priority (0-4)
 */
function normalizePriority(priority: unknown): 0 | 1 | 2 | 3 | 4 {
  if (typeof priority === 'number' && priority >= 0 && priority <= 4) {
    return priority as 0 | 1 | 2 | 3 | 4
  }
  return 2 // default to medium priority
}

/**
 * Parse a single .todo/*.md file
 * @param content - The file content to parse
 * @returns ParsedTodoFile with frontmatter, content, and extracted issue
 */
export function parseTodoFile(content: string): ParsedTodoFile {
  const { frontmatter, body } = parseFrontmatter(content)

  // Extract issue metadata from frontmatter
  const issue: TodoIssue = {
    id: (frontmatter.id as string) || '',
    title: (frontmatter.title as string) || 'Untitled',
    description: body || undefined,
    status: mapStateToStatus(frontmatter.state || frontmatter.status),
    type: normalizeType(frontmatter.type),
    priority: normalizePriority(frontmatter.priority),
    assignee: frontmatter.assignee as string | undefined,
    labels: Array.isArray(frontmatter.labels) ? frontmatter.labels as string[] : undefined,
    createdAt: frontmatter.createdAt as string | undefined,
    updatedAt: frontmatter.updatedAt as string | undefined,
    closedAt: frontmatter.closedAt as string | undefined,
    dependsOn: Array.isArray(frontmatter.dependsOn) ? frontmatter.dependsOn as string[] : undefined,
    blocks: Array.isArray(frontmatter.blocks) ? frontmatter.blocks as string[] : undefined,
    parent: frontmatter.parent as string | undefined,
    children: Array.isArray(frontmatter.children) ? frontmatter.children as string[] : undefined,
    source: 'file',
  }

  return {
    frontmatter,
    content: body,
    issue,
  }
}

/**
 * Load all .todo/*.md files from a directory
 * @param todoDir - Path to the .todo directory
 * @returns Array of TodoIssue objects
 */
export async function loadTodoFiles(todoDir: string): Promise<TodoIssue[]> {
  try {
    const files = await readdir(todoDir)
    const mdFiles = files.filter(f => f.endsWith('.md'))

    const issues: TodoIssue[] = []

    for (const file of mdFiles) {
      try {
        const filePath = join(todoDir, file)
        const content = await readFile(filePath, 'utf-8')
        const parsed = parseTodoFile(content)
        issues.push(parsed.issue)
      } catch (err) {
        // Skip files that can't be parsed, but log error
        console.warn(`Failed to parse ${file}:`, err)
      }
    }

    return issues
  } catch (err) {
    // If directory doesn't exist or can't be read, return empty array
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw err
  }
}
