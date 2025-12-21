/**
 * Parser for .roadmap/*.md files
 * Extracts milestone data from markdown + frontmatter
 */

import type { Milestone, ParsedRoadmapFile } from './types.js'
import { extractFrontmatter } from '@todo.mdx/shared/yaml'

/** Parse a roadmap milestone markdown file */
export function parseRoadmapFile(content: string): ParsedRoadmapFile {
  const { frontmatter, content: body } = extractFrontmatter(content)

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
