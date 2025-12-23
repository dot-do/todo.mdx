/**
 * Generator for .todo/*.md files from TodoIssue objects
 */
import { promises as fs } from 'node:fs'
import { join, resolve } from 'node:path'
import type { TodoIssue } from './types.js'

/**
 * Sanitize issue ID to prevent path traversal attacks
 * Removes/replaces dangerous path characters: /, \, .., :, <, >, |, ?, *, \0
 */
function sanitizeId(id: string): string {
  return id
    .replace(/\0/g, '') // Remove null bytes
    .replace(/\.\./g, '') // Remove parent directory references first
    .replace(/\\/g, '') // Remove backslashes
    .replace(/\//g, '-') // Replace forward slashes with hyphens
    .replace(/[:<>|?*]/g, '') // Remove Windows-invalid characters
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .trim()
}

/**
 * Slugify a string for use in filenames
 * Converts to lowercase, replaces spaces with hyphens, removes special chars
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

/**
 * Generate filename from issue ID and title
 * Pattern: {id}-{title-slug}.md
 */
function generateFilename(issue: TodoIssue): string {
  const safeId = sanitizeId(issue.id)
  const slug = slugify(issue.title)
  return `${safeId}-${slug}.md`
}

/**
 * Serialize a value for YAML frontmatter
 * Handles strings, numbers, booleans, arrays, dates, null/undefined
 */
function serializeYamlValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null'
  }

  if (typeof value === 'string') {
    // Quote strings that contain special characters or start with special chars
    if (value.includes(':') || value.includes('#') || value.includes('"') ||
        value.includes('\n') || value.startsWith('[') || value.startsWith('{')) {
      return `"${value.replace(/"/g, '\\"')}"`
    }
    return `"${value}"`
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]'
    }
    return `[${value.map(v => serializeYamlValue(v)).join(', ')}]`
  }

  return String(value)
}

/**
 * Generate YAML frontmatter from issue metadata
 */
function generateFrontmatter(issue: TodoIssue): string {
  const lines: string[] = ['---']

  // Required fields
  lines.push(`id: ${issue.id}`)
  lines.push(`title: ${serializeYamlValue(issue.title)}`)
  lines.push(`state: ${issue.status}`)
  lines.push(`priority: ${issue.priority}`)
  lines.push(`type: ${issue.type}`)

  // Optional fields
  if (issue.labels && issue.labels.length > 0) {
    lines.push(`labels: ${serializeYamlValue(issue.labels)}`)
  } else {
    lines.push(`labels: []`)
  }

  if (issue.assignee) {
    lines.push(`assignee: ${serializeYamlValue(issue.assignee)}`)
  }

  if (issue.createdAt) {
    lines.push(`createdAt: ${serializeYamlValue(issue.createdAt)}`)
  }

  if (issue.updatedAt) {
    lines.push(`updatedAt: ${serializeYamlValue(issue.updatedAt)}`)
  }

  if (issue.closedAt) {
    lines.push(`closedAt: ${serializeYamlValue(issue.closedAt)}`)
  }

  if (issue.parent) {
    lines.push(`parent: ${serializeYamlValue(issue.parent)}`)
  }

  if (issue.source) {
    lines.push(`source: ${serializeYamlValue(issue.source)}`)
  }

  lines.push('---')

  return lines.join('\n')
}

/**
 * Generate markdown body with H1 heading and description
 */
function generateBody(issue: TodoIssue): string {
  const lines: string[] = []

  // H1 heading with title
  lines.push(`# ${issue.title}`)
  lines.push('')

  // Description if present
  if (issue.description && issue.description.trim()) {
    lines.push(issue.description.trim())
    lines.push('')
  }

  // Dependency information (blocks/dependsOn)
  const hasDependencies = (issue.dependsOn && issue.dependsOn.length > 0) ||
                          (issue.blocks && issue.blocks.length > 0) ||
                          (issue.children && issue.children.length > 0)

  if (hasDependencies) {
    lines.push('### Related Issues')
    lines.push('')

    if (issue.dependsOn && issue.dependsOn.length > 0) {
      lines.push('**Depends on:**')
      issue.dependsOn.forEach(dep => {
        lines.push(`- [${dep}](./${dep}.md)`)
      })
      lines.push('')
    }

    if (issue.blocks && issue.blocks.length > 0) {
      lines.push('**Blocks:**')
      issue.blocks.forEach(block => {
        lines.push(`- [${block}](./${block}.md)`)
      })
      lines.push('')
    }

    if (issue.children && issue.children.length > 0) {
      lines.push('**Children:**')
      issue.children.forEach(child => {
        lines.push(`- [${child}](./${child}.md)`)
      })
      lines.push('')
    }
  }

  // Timeline section
  lines.push('### Timeline')
  lines.push('')

  if (issue.createdAt) {
    const date = new Date(issue.createdAt)
    lines.push(`- **Created:** ${date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}`)
  }

  if (issue.updatedAt) {
    const date = new Date(issue.updatedAt)
    lines.push(`- **Updated:** ${date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}`)
  }

  if (issue.closedAt) {
    const date = new Date(issue.closedAt)
    lines.push(`- **Closed:** ${date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}`)
  }

  lines.push('')

  return lines.join('\n')
}

/**
 * Generate a complete .todo/*.md file from a TodoIssue
 * @param issue - The issue to generate markdown for
 * @returns The complete markdown content
 */
export function generateTodoFile(issue: TodoIssue): string {
  const frontmatter = generateFrontmatter(issue)
  const body = generateBody(issue)

  return `${frontmatter}\n\n${body}`
}

/**
 * Validate that a file path is within the target directory
 * @param filepath - The file path to validate
 * @param targetDir - The target directory
 * @throws Error if path escapes the target directory
 */
function validatePathSafety(filepath: string, targetDir: string): void {
  const resolvedPath = resolve(filepath)
  const resolvedTarget = resolve(targetDir)

  // Check if the resolved path starts with the target directory
  // Add path separator to prevent false positives (e.g., /foo vs /foobar)
  const isWithinTarget =
    resolvedPath === resolvedTarget ||
    resolvedPath.startsWith(resolvedTarget + '/') ||
    resolvedPath.startsWith(resolvedTarget + '\\')

  if (!isWithinTarget) {
    throw new Error(
      `Security: Attempted path traversal detected. File path "${filepath}" resolves outside target directory "${targetDir}"`
    )
  }
}

/**
 * Write TodoIssue objects to .todo/*.md files
 * @param issues - Array of issues to write
 * @param todoDir - Path to .todo directory (default: '.todo')
 * @returns Array of written file paths (absolute paths)
 */
export async function writeTodoFiles(
  issues: TodoIssue[],
  todoDir: string = '.todo'
): Promise<string[]> {
  // Create .todo directory if it doesn't exist
  await fs.mkdir(todoDir, { recursive: true })

  const writtenPaths: string[] = []

  for (const issue of issues) {
    const filename = generateFilename(issue)
    const filepath = join(todoDir, filename)

    // Security: Validate that the resolved path is within the target directory
    validatePathSafety(filepath, todoDir)

    const content = generateTodoFile(issue)
    await fs.writeFile(filepath, content, 'utf-8')
    writtenPaths.push(filepath)
  }

  return writtenPaths
}
