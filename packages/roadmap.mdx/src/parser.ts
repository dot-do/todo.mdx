/**
 * Parser for .roadmap/*.md files
 * Extracts milestone data from markdown + frontmatter
 */

import type { Milestone, ParsedRoadmapFile } from './types.js'

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

/** Parse a roadmap milestone markdown file */
export function parseRoadmapFile(content: string): ParsedRoadmapFile {
  let frontmatter: Record<string, unknown> = {}
  let body = content

  const match = content.match(FRONTMATTER_REGEX)
  if (match) {
    frontmatter = parseYaml(match[1])
    body = content.slice(match[0].length)
  }

  // Extract milestone data from frontmatter
  const milestone: Partial<Milestone> = {}

  if (frontmatter.id) milestone.id = String(frontmatter.id)
  if (frontmatter.github_id) milestone.githubId = Number(frontmatter.github_id)
  if (frontmatter.github_number) milestone.githubNumber = Number(frontmatter.github_number)
  if (frontmatter.beads_id) milestone.beadsId = String(frontmatter.beads_id)
  if (frontmatter.title) milestone.title = String(frontmatter.title)
  if (frontmatter.state) milestone.state = frontmatter.state as Milestone['state']
  if (frontmatter.due_on || frontmatter.dueOn) {
    milestone.dueOn = String(frontmatter.due_on || frontmatter.dueOn)
  }

  // Description is the body content
  milestone.description = body.trim()

  // Try to extract title from first H1 if not in frontmatter
  if (!milestone.title) {
    const h1Match = body.match(/^#\s+(.+)$/m)
    if (h1Match) {
      milestone.title = h1Match[1].trim()
      // Remove H1 from description
      milestone.description = body.replace(/^#\s+.+\r?\n?/, '').trim()
    }
  }

  return {
    frontmatter,
    content: body,
    milestone,
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

/** Calculate completion progress from tasks in content */
export function calculateProgress(content: string): { open: number; closed: number; percent: number } {
  const tasks = extractTasks(content)
  const closed = tasks.filter(t => t.checked).length
  const open = tasks.length - closed
  const percent = tasks.length > 0 ? Math.round((closed / tasks.length) * 100) : 0

  return { open, closed, percent }
}
