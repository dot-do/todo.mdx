/**
 * Generator for .todo/*.md files from TodoIssue objects
 * Output format compatible with @mdxld/markdown fromMarkdown() for round-trip parsing
 */
import { promises as fs } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import type { TodoIssue } from './types.js'
import { applyPattern } from './patterns.js'

/** Default filename pattern: date + title with spaces preserved */
export const DEFAULT_PATTERN = '[yyyy-mm-dd] [Title].md'

export interface GeneratorOptions {
  /** Filename pattern (default: '[yyyy-mm-dd] [Title].md') */
  pattern?: string
  /** Subdirectory for closed issues (default: 'closed') */
  closedSubdir?: string
  /** Whether to organize closed issues into subdirectory (default: true) */
  separateClosed?: boolean
}

/**
 * Generate filename from issue using pattern system
 * Closed issues go into closedSubdir if separateClosed is true
 */
function generateFilename(issue: TodoIssue, options: GeneratorOptions = {}): string {
  const pattern = options.pattern || DEFAULT_PATTERN
  const closedSubdir = options.closedSubdir || 'closed'
  const separateClosed = options.separateClosed !== false // default true

  const filename = applyPattern(pattern, issue)

  // Put closed issues in subfolder
  if (separateClosed && issue.status === 'closed') {
    return join(closedSubdir, filename)
  }

  return filename
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
 * @param options - Generator options for pattern and closed subfolder
 * @returns Array of written file paths (absolute paths)
 */
export async function writeTodoFiles(
  issues: TodoIssue[],
  todoDir: string = '.todo',
  options: GeneratorOptions = {}
): Promise<string[]> {
  // Resolve todoDir to absolute path for consistent validation
  const resolvedTodoDir = resolve(todoDir)

  // Create .todo directory if it doesn't exist
  await fs.mkdir(resolvedTodoDir, { recursive: true })

  // Create closed subdirectory if needed - but validate FIRST
  const closedSubdir = options.closedSubdir || 'closed'
  const separateClosed = options.separateClosed !== false
  if (separateClosed) {
    const closedPath = join(resolvedTodoDir, closedSubdir)
    // Security: Validate closed subdirectory BEFORE creating
    validatePathSafety(closedPath, resolvedTodoDir)
    await fs.mkdir(closedPath, { recursive: true })
  }

  const writtenPaths: string[] = []

  for (const issue of issues) {
    const filename = generateFilename(issue, options)
    const filepath = join(resolvedTodoDir, filename)

    // Security: Validate BEFORE creating any directories or files
    validatePathSafety(filepath, resolvedTodoDir)

    // Ensure subdirectory exists (for patterns with directories like [type]/...)
    const fileDir = dirname(filepath)
    if (fileDir !== resolvedTodoDir) {
      // Security: Validate subdirectory path BEFORE creating
      validatePathSafety(fileDir, resolvedTodoDir)
      await fs.mkdir(fileDir, { recursive: true })
    }

    const content = generateTodoFile(issue)
    await fs.writeFile(filepath, content, 'utf-8')
    writtenPaths.push(filepath)
  }

  return writtenPaths
}
