/**
 * Simplified MDX compiler using template replacement
 * Similar approach to todo.mdx but with terminal rendering support
 */

import { readFile, writeFile } from 'node:fs/promises'
import chalk from 'chalk'
import { setComponentData, getComponentData } from './components.js'
import { loadAllData } from './loader.js'
import type { CliConfig, Issue } from './types.js'

/** Frontmatter regex */
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/** Simple YAML parser */
function parseYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const line of yaml.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue
    const key = line.slice(0, colonIndex).trim()
    let value: unknown = line.slice(colonIndex + 1).trim()
    if (value === 'true') value = true
    else if (value === 'false') value = false
    else if (/^\d+$/.test(value as string)) value = parseInt(value as string, 10)
    else if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

/** Parse frontmatter from content */
function parseFrontmatter(content: string): {
  frontmatter: Record<string, any>
  content: string
} {
  const match = content.match(FRONTMATTER_REGEX)
  if (!match) {
    return { frontmatter: {}, content }
  }

  const frontmatter = parseYaml(match[1])
  const remainingContent = content.slice(match[0].length)

  return { frontmatter, content: remainingContent }
}

/** Compile MDX file */
export async function compile(config: CliConfig = {}): Promise<string> {
  const {
    input = 'CLI.mdx',
    output,
    mode = 'terminal',
    beads = true,
  } = config

  // Load data from beads
  let data = beads
    ? await loadAllData()
    : {
        issues: [],
        milestones: [],
        stats: { total: 0, open: 0, in_progress: 0, blocked: 0, closed: 0, percent: 0 },
      }

  // Set component data
  setComponentData(data)

  // Read MDX file
  let mdxContent: string
  try {
    mdxContent = await readFile(input, 'utf-8')
  } catch (error) {
    throw new Error(`Failed to read ${input}: ${error}`)
  }

  // Parse frontmatter
  const { frontmatter, content } = parseFrontmatter(mdxContent)

  // Hydrate template
  const result = hydrateTemplate(content, frontmatter, mode)

  // Output
  if (mode === 'terminal') {
    console.log(result)
  } else if (mode === 'markdown' && output) {
    const finalOutput = frontmatter
      ? `---\n${serializeFrontmatter(frontmatter)}\n---\n\n${result}`
      : result
    await writeFile(output, finalOutput)
  } else if (mode === 'dual') {
    // Terminal output
    const terminalResult = hydrateTemplate(content, frontmatter, 'terminal')
    console.log(terminalResult)

    // Markdown output
    if (output) {
      const mdResult = hydrateTemplate(content, frontmatter, 'markdown')
      const finalOutput = frontmatter
        ? `---\n${serializeFrontmatter(frontmatter)}\n---\n\n${mdResult}`
        : mdResult
      await writeFile(output, finalOutput)
    }
  }

  return result
}

/** Hydrate template with data */
function hydrateTemplate(
  template: string,
  frontmatter: Record<string, any>,
  mode: 'terminal' | 'markdown' | 'dual'
): string {
  // For dual mode, use markdown style (terminal rendering is done separately)
  const renderMode: 'terminal' | 'markdown' = mode === 'dual' ? 'markdown' : mode
  const { issues, milestones, stats } = getComponentData()
  let result = template

  // Replace {variable} placeholders
  result = result.replace(/\{(\w+)\}/g, (_, key) => {
    if (frontmatter[key] !== undefined) {
      return String(frontmatter[key])
    }
    return `{${key}}`
  })

  // Replace component tags
  result = result.replace(/<Stats\s*\/>/g, () => renderStats(stats, renderMode))

  result = result.replace(/<Issues\.Ready(?:\s+limit=\{(\d+)\})?\s*\/>/g, (_, limit) => {
    const ready = issues
      .filter(i => i.state === 'open' && (!i.blockedBy || i.blockedBy.length === 0))
      .slice(0, limit ? parseInt(limit) : 10)
    return renderIssueList(ready, renderMode)
  })

  result = result.replace(/<Issues\.Open(?:\s+limit=\{(\d+)\})?\s*\/>/g, (_, limit) => {
    const open = issues.filter(i => i.state === 'open').slice(0, limit ? parseInt(limit) : 10)
    return renderIssueList(open, renderMode)
  })

  result = result.replace(/<Issues\.InProgress(?:\s+limit=\{(\d+)\})?\s*\/>/g, (_, limit) => {
    const inProgress = issues.filter(i => i.state === 'in_progress').slice(0, limit ? parseInt(limit) : 10)
    return renderIssueList(inProgress, renderMode)
  })

  result = result.replace(/<Issues\.Blocked(?:\s+limit=\{(\d+)\})?\s*\/>/g, (_, limit) => {
    const blocked = issues.filter(i => i.state === 'blocked').slice(0, limit ? parseInt(limit) : 10)
    return renderIssueList(blocked, renderMode)
  })

  result = result.replace(/<Issues\.Closed(?:\s+limit=\{(\d+)\})?\s*\/>/g, (_, limit) => {
    const closed = issues.filter(i => i.state === 'closed').slice(0, limit ? parseInt(limit) : 10)
    return renderIssueList(closed, renderMode)
  })

  result = result.replace(/<Command\s+name="([^"]+)"(?:\s+description="([^"]+)")?\s*\/>/g, (_, name, desc) => {
    return renderCommand(name, desc, renderMode)
  })

  result = result.replace(/<Roadmap(?:\s+limit=\{(\d+)\})?\s*\/>/g, (_, limit) => {
    const milestoneList = milestones.slice(0, limit ? parseInt(limit) : 5)
    return renderRoadmap(milestoneList, renderMode)
  })

  return result
}

/** Render issue list */
function renderIssueList(issues: Issue[], mode: 'terminal' | 'markdown'): string {
  if (issues.length === 0) {
    const text = 'No issues found'
    return mode === 'terminal' ? chalk.dim(text) : `_${text}_`
  }

  const lines: string[] = []
  for (const issue of issues) {
    const checkbox = getCheckbox(issue.state)
    const priority = issue.priority !== undefined ? ` [P${issue.priority}]` : ''
    const labels = issue.labels?.length ? ` (${issue.labels.join(', ')})` : ''

    if (mode === 'terminal') {
      lines.push(
        `  • ${checkbox} ${chalk.bold(issue.id)}${priority}: ${issue.title}${labels}`
      )
    } else {
      lines.push(`- ${checkbox} **${issue.id}**${priority}: ${issue.title}${labels}`)
    }
  }

  lines.push('')
  return lines.join('\n')
}

/** Render stats */
function renderStats(stats: any, mode: 'terminal' | 'markdown'): string {
  const { total, open, in_progress, blocked, closed, percent } = stats

  const parts = [`**${open} open**`]
  if (in_progress > 0) parts.push(`${in_progress} in progress`)
  if (blocked > 0) parts.push(`${blocked} blocked`)
  parts.push(`${closed} closed`)
  parts.push(`${total} total (${percent}% complete)`)

  const text = parts.join(' · ')

  if (mode === 'terminal') {
    return chalk.cyan(text) + '\n'
  }

  return text + '\n'
}

/** Render command */
function renderCommand(name: string, description: string | undefined, mode: 'terminal' | 'markdown'): string {
  if (mode === 'terminal') {
    const cmdText = chalk.green.bold(name)
    const descText = description ? chalk.dim(`  ${description}`) : ''
    return `${cmdText}${descText ? '\n' + descText : ''}\n`
  }

  const cmdText = `**${name}**`
  const descText = description ? `  ${description}` : ''
  return `${cmdText}${descText ? '\n' + descText : ''}\n`
}

/** Render roadmap */
function renderRoadmap(milestones: any[], mode: 'terminal' | 'markdown'): string {
  if (milestones.length === 0) {
    const text = 'No milestones'
    return mode === 'terminal' ? chalk.dim(text) : `_${text}_`
  }

  const lines: string[] = []
  for (const milestone of milestones) {
    const icon = milestone.state === 'open' ? '🎯' : '✅'
    const title = mode === 'terminal' ? chalk.bold(milestone.title) : `**${milestone.title}**`

    lines.push(`${icon} ${title}`)

    if (milestone.progress) {
      const { closed, total, percent } = milestone.progress
      lines.push(`  Progress: ${closed}/${total} (${percent}%)`)
    }
  }

  lines.push('')
  return lines.join('\n')
}

/** Get checkbox for issue state */
function getCheckbox(state: Issue['state']): string {
  switch (state) {
    case 'closed':
      return '[x]'
    case 'in_progress':
      return '[-]'
    case 'blocked':
      return '[!]'
    default:
      return '[ ]'
  }
}

/** Serialize frontmatter to YAML */
function serializeFrontmatter(frontmatter: Record<string, any>): string {
  return Object.entries(frontmatter)
    .map(([key, value]) => {
      if (typeof value === 'string') {
        return `${key}: "${value}"`
      }
      return `${key}: ${value}`
    })
    .join('\n')
}

/** Compile and render to terminal (shorthand) */
export async function renderCli(config: CliConfig = {}): Promise<void> {
  await compile({ ...config, mode: 'terminal' })
}

/** Compile and write to markdown file (shorthand) */
export async function renderMarkdown(config: CliConfig = {}): Promise<void> {
  await compile({ ...config, mode: 'markdown' })
}

/** Compile and do both (shorthand) */
export async function renderDual(config: CliConfig = {}): Promise<void> {
  await compile({ ...config, mode: 'dual' })
}
