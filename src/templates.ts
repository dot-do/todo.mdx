/**
 * Template rendering with slot interpolation
 * Uses @mdxld/extract for parsing template slots
 */

import {
  parseTemplateSlots,
  extract,
  diff,
  applyExtract,
  type ExtractResult,
  type ExtractDiff,
  type ComponentExtractor,
} from '@mdxld/extract'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { TodoIssue } from './types.js'
import * as issueComponents from './components/issues.js'

// Re-export components for use in templates
export { issueComponents as components }

/**
 * Configuration for template resolution
 */
export interface TemplateConfig {
  /** Directory for custom templates (default: '.mdx') */
  templateDir?: string
  /** Preset name to use if custom template not found */
  preset?: 'minimal' | 'detailed' | 'github' | 'linear'
}

/**
 * Context for template rendering
 */
export interface TemplateContext {
  issue: TodoIssue
}

/**
 * Resolve a path like 'issue.title' or 'issue.labels' against a context object
 */
function resolvePath(path: string, context: TemplateContext): unknown {
  const parts = path.split('.')
  let value: any = context

  for (const part of parts) {
    if (value === null || value === undefined) {
      return undefined
    }
    value = value[part]
  }

  return value
}

/**
 * Format a value for rendering in a template
 * - Arrays are joined with ', '
 * - null/undefined become empty string
 * - Everything else is converted to string
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (Array.isArray(value)) {
    return value.join(', ')
  }

  return String(value)
}

/**
 * Render template using @mdxld/markdown-style render() function
 *
 * This function provides an @mdxld/markdown-compatible render() interface.
 * Since render() doesn't exist in @mdxld/markdown v1.9.0, we implement it
 * using @mdxld/extract's parseTemplateSlots.
 *
 * Supports:
 * - Simple interpolation: {data.field} → "value"
 * - Nested paths: {data.nested.field}
 * - Arrays: {data.items} → "item1, item2" (auto-formatted)
 * - Escaped braces: {{notASlot}} → {notASlot}
 * - Components can be passed in data.components
 *
 * @param template - Template string with {path} slots
 * @param data - Data object containing all context (including components)
 * @returns Rendered template string
 */
export function render(
  template: string,
  data: Record<string, unknown>
): string {
  // Handle escaped double braces first - convert to placeholder
  const DOUBLE_BRACE_PLACEHOLDER = '\u0000DOUBLE_BRACE\u0000'
  let processed = template.replace(/\{\{([^}]*)\}\}/g, (_, content) => {
    return DOUBLE_BRACE_PLACEHOLDER + content + DOUBLE_BRACE_PLACEHOLDER
  })

  // Parse template slots using @mdxld/extract
  const slots = parseTemplateSlots(processed)

  // Filter for expression slots only (ignore components, conditionals, loops)
  const expressionSlots = slots.filter((slot) => slot.type === 'expression')

  // Sort slots by position (reverse order) so we can replace from end to start
  // This prevents position shifts from affecting subsequent replacements
  const sortedSlots = [...expressionSlots].sort((a, b) => b.start - a.start)

  // Replace each slot with its resolved value
  for (const slot of sortedSlots) {
    // Resolve path against data context
    const parts = slot.path.split('.')
    let value: any = data

    for (const part of parts) {
      if (value === null || value === undefined) {
        value = undefined
        break
      }
      value = value[part]
    }

    // Format the value
    const formatted = formatValue(value)

    // Replace the slot in the template
    processed =
      processed.slice(0, slot.start) +
      formatted +
      processed.slice(slot.end)
  }

  // Restore escaped double braces
  const placeholderPattern = DOUBLE_BRACE_PLACEHOLDER.replace(/[\u0000]/g, '\\u0000')
  processed = processed.replace(
    new RegExp(placeholderPattern + '(.*?)' + placeholderPattern, 'g'),
    (_, content) => '{' + content + '}'
  )

  return processed
}


/**
 * Render a template string with slot interpolation
 *
 * Supports:
 * - Simple interpolation: {issue.title} → "My Title"
 * - Nested paths: {issue.assignee.name}
 * - Arrays: {issue.labels} → "bug, urgent"
 * - Escaped braces: {{notASlot}} → {notASlot}
 *
 * @param template - Template string with {path} slots
 * @param context - Context object with issue data
 * @returns Rendered template string
 */
export function renderTemplate(
  template: string,
  context: TemplateContext
): string {
  // Use render() from @mdxld/markdown (implemented above)
  return render(template, {
    ...context,
    components: issueComponents,
  })
}

/**
 * Built-in minimal issue template
 * Uses {path} slot syntax for interpolation and MDX component syntax
 */
const BUILTIN_ISSUE_MINIMAL = `---
$pattern: "[id]-[title].md"
---
# {issue.title}

**Status:** {issue.status} | **Priority:** {issue.priority} | **Type:** {issue.type}

**Assignee:** @{issue.assignee}

## Description

{issue.description}

## Labels

<Issue.Labels />

## Dependencies

<Issue.Dependencies />

## Blocks

<Issue.Dependents />
`

/**
 * Built-in detailed issue template
 * Uses {path} slot syntax for interpolation
 */
const BUILTIN_ISSUE_DETAILED = `---
$pattern: "[id]-[title].md"
id: {issue.id}
title: {issue.title}
state: {issue.status}
priority: {issue.priority}
type: {issue.type}
labels: {issue.labels}
assignee: {issue.assignee}
createdAt: {issue.createdAt}
updatedAt: {issue.updatedAt}
closedAt: {issue.closedAt}
parent: {issue.parent}
source: {issue.source}
dependsOn: {issue.dependsOn}
blocks: {issue.blocks}
children: {issue.children}
---
# {issue.title}

{issue.description}

## Metadata

- **ID:** {issue.id}
- **Status:** {issue.status}
- **Priority:** {issue.priority}
- **Type:** {issue.type}
- **Assignee:** {issue.assignee}
- **Labels:** {issue.labels}

## Timeline

- **Created:** {issue.createdAt}
- **Updated:** {issue.updatedAt}
- **Closed:** {issue.closedAt}

## Related Issues

**Depends on:**
{issue.dependsOn}

**Blocks:**
{issue.blocks}

**Children:**
{issue.children}
`

/**
 * Built-in GitHub-style issue template
 * Uses {path} slot syntax for interpolation
 */
const BUILTIN_ISSUE_GITHUB = `---
$pattern: "[id]-[title].md"
---
# {issue.title}

{issue.description}

---

## Labels

{issue.labels}

## Metadata

- **Status:** \`{issue.status}\`
- **Priority:** \`{issue.priority}\`
- **Type:** \`{issue.type}\`
- **Assignee:** @{issue.assignee}

## Related Issues

**Depends on:** {issue.dependsOn}
**Blocks:** {issue.blocks}

---

## Comments

<!-- Discussion and activity go here -->
`

/**
 * Built-in Linear-style issue template
 * Uses {path} slot syntax for interpolation
 */
const BUILTIN_ISSUE_LINEAR = `---
$pattern: "[id]-[title].md"
---
# {issue.title}

{issue.description}

## Details

- **Project:** {issue.project}
- **Cycle:** {issue.cycle}
- **Team:** {issue.team}
- **Status:** {issue.status}
- **Priority:** {issue.priority}
- **Assignee:** {issue.assignee}
- **Labels:** {issue.labels}

## Timeline

- **Created:** {issue.createdAt}
- **Updated:** {issue.updatedAt}
- **Closed:** {issue.closedAt}

## Related

**Depends on:** {issue.dependsOn}
**Blocks:** {issue.blocks}
**Parent:** {issue.parent}
**Children:** {issue.children}
`

/**
 * Built-in minimal TODO template
 * Uses {path} slot syntax for interpolation and MDX component syntax
 */
const BUILTIN_TODO_MINIMAL = `# TODO

**Generated:** {timestamp}

## Summary

- **Total:** {stats.total}
- **Open:** {stats.open}
- **In Progress:** {stats.inProgress}
- **Blocked:** {stats.blocked}

## Blocked Issues

<Issues.Blocked columns={['id', 'title', 'blockedBy']} />

## Ready to Work

<Issues.Ready limit={10} columns={['id', 'title', 'priority']} />

## All Open Issues

<Issues status="open" columns={['id', 'title', 'priority', 'type']} />

## Recently Closed

<Issues.Closed limit={5} columns={['id', 'title', 'closedAt']} />
`

/**
 * Built-in detailed TODO template
 * Uses {path} slot syntax for interpolation and MDX component syntax
 */
const BUILTIN_TODO_DETAILED = `# TODO

**Generated:** {timestamp}

## Summary

- **Total:** {stats.total}
- **Open:** {stats.open}
- **In Progress:** {stats.inProgress}
- **Blocked:** {stats.blocked}
- **Ready:** {stats.ready}

## Blocked Issues

<Issues.Blocked columns={['id', 'title', 'priority', 'blockedBy']} />

## In Progress

<Issues status="in_progress" columns={['id', 'title', 'assignee', 'priority']} />

## Ready to Work

<Issues.Ready limit={10} columns={['id', 'title', 'priority', 'type']} />

## All Open Issues

<Issues status="open" columns={['id', 'title', 'priority', 'type', 'labels']} />

## Recently Closed

<Issues.Closed limit={10} columns={['id', 'title', 'closedAt']} />
`

/**
 * Built-in GitHub-style TODO template
 */
const BUILTIN_TODO_GITHUB = BUILTIN_TODO_DETAILED

/**
 * Built-in Linear-style TODO template
 */
const BUILTIN_TODO_LINEAR = BUILTIN_TODO_MINIMAL

/**
 * Get built-in template for a given type and preset
 */
function getBuiltinTemplate(type: 'issue' | 'todo', preset: string): string {
  if (type === 'issue') {
    switch (preset) {
      case 'detailed':
        return BUILTIN_ISSUE_DETAILED
      case 'github':
        return BUILTIN_ISSUE_GITHUB
      case 'linear':
        return BUILTIN_ISSUE_LINEAR
      case 'minimal':
      default:
        return BUILTIN_ISSUE_MINIMAL
    }
  } else {
    switch (preset) {
      case 'detailed':
        return BUILTIN_TODO_DETAILED
      case 'github':
        return BUILTIN_TODO_GITHUB
      case 'linear':
        return BUILTIN_TODO_LINEAR
      case 'minimal':
      default:
        return BUILTIN_TODO_MINIMAL
    }
  }
}

/**
 * Check if a file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Resolve template following the resolution chain:
 * 1. Custom template in .mdx/[Issue].mdx or .mdx/TODO.mdx
 * 2. Preset template in .mdx/presets/{preset}.mdx (if config.preset specified)
 * 3. Built-in template for the specified preset (defaults to 'minimal')
 *
 * @param type - Type of template ('issue' or 'todo')
 * @param config - Template configuration
 * @returns Template content as string
 */
export async function resolveTemplate(
  type: 'issue' | 'todo',
  config?: TemplateConfig
): Promise<string> {
  const templateDir = config?.templateDir || '.mdx'
  const preset = config?.preset || 'minimal'

  // 1. Check for custom template
  const customTemplateName = type === 'issue' ? '[Issue].mdx' : 'TODO.mdx'
  const customTemplatePath = join(templateDir, customTemplateName)

  if (await fileExists(customTemplatePath)) {
    try {
      return await fs.readFile(customTemplatePath, 'utf-8')
    } catch {
      // Fall through to next option
    }
  }

  // 2. Check for preset template (if specified)
  if (config?.preset) {
    const presetPath = join(templateDir, 'presets', `${preset}.mdx`)
    if (await fileExists(presetPath)) {
      try {
        return await fs.readFile(presetPath, 'utf-8')
      } catch {
        // Fall through to built-in
      }
    }
  }

  // 3. Return built-in template
  return getBuiltinTemplate(type, preset)
}

/**
 * Extract structured data from rendered markdown using an MDX template
 *
 * This enables bi-directional sync: markdown files can be edited, and changes
 * are extracted back to the original structured data (issue props).
 *
 * @example
 * ```ts
 * const template = `# {issue.title}\n\n{issue.description}`
 * const rendered = `# Updated Title\n\nNew description`
 * const result = extractFromMarkdown(template, rendered)
 * // result.data = { issue: { title: 'Updated Title', description: 'New description' } }
 * ```
 *
 * @param template - MDX template with {path} slots
 * @param renderedMarkdown - Rendered markdown (possibly edited)
 * @param components - Optional component extractors for custom components
 * @returns ExtractResult with extracted data, confidence score, and metadata
 */
export function extractFromMarkdown<T = Record<string, unknown>>(
  template: string,
  renderedMarkdown: string,
  components?: Record<string, ComponentExtractor>
): ExtractResult<T> {
  return extract<T>({
    template,
    rendered: renderedMarkdown,
    components: components || {},
  })
}

/**
 * Re-export diff for computing changes between original and extracted data
 *
 * @example
 * ```ts
 * const original = { issue: { title: 'Hello', status: 'open' } }
 * const extracted = { issue: { title: 'Updated', status: 'open' } }
 * const changes = diff(original, extracted)
 * // changes.modified = { 'issue.title': { from: 'Hello', to: 'Updated' } }
 * ```
 */
export { diff }

/**
 * Re-export applyExtract for applying extracted changes to original data
 *
 * @example
 * ```ts
 * const original = { issue: { title: 'Hello', description: 'Original', status: 'open' } }
 * const extracted = { issue: { title: 'Updated' } }
 * const merged = applyExtract(original, extracted)
 * // merged = { issue: { title: 'Updated', description: 'Original', status: 'open' } }
 * ```
 */
export { applyExtract }

/**
 * Re-export types for use in consuming code
 */
export type { ExtractResult, ExtractDiff, ComponentExtractor }
