/**
 * Parser for .todo/*.md files
 * Uses @mdxld/markdown for robust frontmatter extraction
 */

import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { Markdown } from '@mdxld/markdown'
import type { ParsedTodoFile, TodoIssue } from './types.js'

/**
 * Parse a value from YAML-like string format
 * Handles: strings, numbers, booleans, arrays, null
 */
function parseYamlValue(value: string): unknown {
  const trimmed = value.trim()

  // Handle null
  if (trimmed === 'null' || trimmed === 'undefined') {
    return null
  }

  // Handle booleans
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false

  // Handle numbers
  if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10)
  if (/^-?\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed)

  // Handle arrays in JSON format
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      // Fallback: parse as comma-separated strings
      const content = trimmed.slice(1, -1)
      return content.split(',').map(item => {
        const cleaned = item.trim()
        // Remove quotes if present
        if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
            (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
          return cleaned.slice(1, -1)
        }
        return cleaned
      }).filter(Boolean)
    }
  }

  // Handle quoted strings
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }

  // Return as-is (unquoted string)
  return trimmed
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
 * Clamps values to the valid range and floors non-integers
 */
function normalizePriority(priority: unknown): 0 | 1 | 2 | 3 | 4 {
  if (typeof priority === 'number' && !Number.isNaN(priority)) {
    // Floor non-integers and clamp to 0-4 range
    const clamped = Math.max(0, Math.min(4, Math.floor(priority)))
    return clamped as 0 | 1 | 2 | 3 | 4
  }
  return 2 // default to medium priority
}

/**
 * Validate issue ID
 * Throws if ID is empty, whitespace-only, null, or undefined
 */
function validateId(id: unknown): string {
  if (id === null || id === undefined || id === '') {
    throw new Error('ID cannot be empty or undefined')
  }

  if (typeof id !== 'string') {
    throw new Error('ID must be a string')
  }

  const trimmed = id.trim()
  if (trimmed === '') {
    throw new Error('ID cannot be empty or whitespace-only')
  }

  return id
}

/**
 * Parse a single .todo/*.md file
 * Uses Markdown.extractMeta() from @mdxld/markdown for robust frontmatter parsing
 * @param content - The file content to parse
 * @returns ParsedTodoFile with frontmatter, content, and extracted issue
 */
export function parseTodoFile(content: string): ParsedTodoFile {
  // Use Markdown.extractMeta() to extract frontmatter as strings
  const metaStrings = Markdown.extractMeta(content)

  // Parse values from strings to proper types
  const frontmatter: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metaStrings)) {
    frontmatter[key] = parseYamlValue(value)
  }

  // Extract body content (everything after frontmatter)
  const frontmatterMatch = content.match(/^---\s*\n[\s\S]*?\n---\s*\n/m)
  const body = frontmatterMatch ? content.slice(frontmatterMatch[0].length).trim() : content.trim()

  // Validate and extract ID
  const id = validateId(frontmatter.id)

  // Extract issue metadata, using parsed frontmatter
  const issue: TodoIssue = {
    id,
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
    source: (frontmatter.source as 'beads' | 'file') || 'file',
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
