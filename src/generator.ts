/**
 * Generator for .todo/*.md files from TodoIssue objects
 * Output format compatible with @mdxld/markdown fromMarkdown() for round-trip parsing
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
 * Uses simple, readable YAML format compatible with fromMarkdown()
 */
function serializeYamlValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null'
  }

  if (typeof value === 'string') {
    // Always quote strings for consistency and safety
    return `"${value.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
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
 * Output format compatible with @mdxld/markdown fromMarkdown()
 */
function generateFrontmatter(issue: TodoIssue): string {
  const lines: string[] = ['---']

  // Required fields
  lines.push(`id: ${issue.id}`)
  lines.push(`title: ${serializeYamlValue(issue.title)}`)
  lines.push(`state: ${issue.status}`) // Use 'state' for parser compatibility
  lines.push(`priority: ${issue.priority}`)
  lines.push(`type: ${issue.type}`)

  // Labels (always include, even if empty)
  lines.push(`labels: ${serializeYamlValue(issue.labels || [])}`)

  // Optional metadata fields
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

  // Store dependency arrays in frontmatter for fromMarkdown() compatibility
  if (issue.dependsOn && issue.dependsOn.length > 0) {
    lines.push(`dependsOn: ${serializeYamlValue(issue.dependsOn)}`)
  }

  if (issue.blocks && issue.blocks.length > 0) {
    lines.push(`blocks: ${serializeYamlValue(issue.blocks)}`)
  }

  if (issue.children && issue.children.length > 0) {
    lines.push(`children: ${serializeYamlValue(issue.children)}`)
  }

  lines.push('---')

  return lines.join('\n')
}

/**
 * Generate markdown body content
 * Creates H1 heading, description, and dependency links
 */
function generateBody(issue: TodoIssue): string {
  const sections: string[] = []

  // H1 heading with title
  sections.push(`# ${issue.title}`)

  // Description if present
  if (issue.description && issue.description.trim()) {
    sections.push('')
    sections.push(issue.description.trim())
  }

  // Related Issues section with markdown links
  const hasDependencies = (issue.dependsOn && issue.dependsOn.length > 0) ||
                          (issue.blocks && issue.blocks.length > 0) ||
                          (issue.children && issue.children.length > 0)

  if (hasDependencies) {
    sections.push('')
    sections.push('### Related Issues')

    if (issue.dependsOn && issue.dependsOn.length > 0) {
      sections.push('')
      sections.push('**Depends on:**')
      issue.dependsOn.forEach(dep => {
        sections.push(`- [${dep}](./${dep}.md)`)
      })
    }

    if (issue.blocks && issue.blocks.length > 0) {
      sections.push('')
      sections.push('**Blocks:**')
      issue.blocks.forEach(block => {
        sections.push(`- [${block}](./${block}.md)`)
      })
    }

    if (issue.children && issue.children.length > 0) {
      sections.push('')
      sections.push('**Children:**')
      issue.children.forEach(child => {
        sections.push(`- [${child}](./${child}.md)`)
      })
    }
  }

  return sections.join('\n')
}

/**
 * Generate a complete .todo/*.md file from a TodoIssue
 * Uses manual generation for full control over output format
 * Output is compatible with @mdxld/markdown fromMarkdown() parser
 *
 * @param issue - The issue to generate markdown for
 * @returns The complete markdown content with frontmatter and body
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
