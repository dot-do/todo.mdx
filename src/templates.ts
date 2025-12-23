/**
 * Template rendering with slot interpolation
 * Uses @mdxld/extract for parsing template slots
 */

import { parseTemplateSlots } from '@mdxld/extract'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { TodoIssue } from './types.js'

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
    const value = resolvePath(slot.path, context)
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
 * Built-in minimal issue template
 */
const BUILTIN_ISSUE_MINIMAL = `---
id: {{issue.id}}
title: "{{issue.title}}"
state: {{issue.status}}
priority: {{issue.priority}}
type: {{issue.type}}
labels: {{#if issue.labels}}[{{#each issue.labels}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}]{{else}}[]{{/if}}
{{#if issue.assignee}}assignee: "{{issue.assignee}}"{{/if}}
{{#if issue.createdAt}}createdAt: "{{issue.createdAt}}"{{/if}}
{{#if issue.updatedAt}}updatedAt: "{{issue.updatedAt}}"{{/if}}
{{#if issue.closedAt}}closedAt: "{{issue.closedAt}}"{{/if}}
{{#if issue.parent}}parent: "{{issue.parent}}"{{/if}}
{{#if issue.source}}source: "{{issue.source}}"{{/if}}
{{#if issue.dependsOn}}dependsOn: [{{#each issue.dependsOn}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}]{{/if}}
{{#if issue.blocks}}blocks: [{{#each issue.blocks}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}]{{/if}}
{{#if issue.children}}children: [{{#each issue.children}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}]{{/if}}
---

# {{issue.title}}

{{#if issue.description}}
{{issue.description}}
{{/if}}

{{#if issue.dependsOn}}
### Related Issues

**Depends on:**
{{#each issue.dependsOn}}
- [{{this}}](./{{this}}.md)
{{/each}}
{{/if}}

{{#if issue.blocks}}
**Blocks:**
{{#each issue.blocks}}
- [{{this}}](./{{this}}.md)
{{/each}}
{{/if}}

{{#if issue.children}}
**Children:**
{{#each issue.children}}
- [{{this}}](./{{this}}.md)
{{/each}}
{{/if}}
`

/**
 * Built-in detailed issue template
 */
const BUILTIN_ISSUE_DETAILED = `---
id: {{issue.id}}
title: "{{issue.title}}"
state: {{issue.status}}
priority: {{issue.priority}}
type: {{issue.type}}
labels: {{#if issue.labels}}[{{#each issue.labels}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}]{{else}}[]{{/if}}
{{#if issue.assignee}}assignee: "{{issue.assignee}}"{{/if}}
{{#if issue.createdAt}}createdAt: "{{issue.createdAt}}"{{/if}}
{{#if issue.updatedAt}}updatedAt: "{{issue.updatedAt}}"{{/if}}
{{#if issue.closedAt}}closedAt: "{{issue.closedAt}}"{{/if}}
{{#if issue.parent}}parent: "{{issue.parent}}"{{/if}}
{{#if issue.source}}source: "{{issue.source}}"{{/if}}
---

# {{issue.title}}

**Status:** {{issue.status}} | **Priority:** {{issue.priority}} | **Type:** {{issue.type}}

{{#if issue.assignee}}
**Assignee:** {{issue.assignee}}
{{/if}}

{{#if issue.labels}}
**Labels:** {{#each issue.labels}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}

## Description

{{#if issue.description}}
{{issue.description}}
{{else}}
No description provided.
{{/if}}

## Metadata

- **Created:** {{#if issue.createdAt}}{{issue.createdAt}}{{else}}N/A{{/if}}
- **Updated:** {{#if issue.updatedAt}}{{issue.updatedAt}}{{else}}N/A{{/if}}
{{#if issue.closedAt}}
- **Closed:** {{issue.closedAt}}
{{/if}}

{{#if issue.dependsOn}}
## Dependencies

This issue depends on:
{{#each issue.dependsOn}}
- [{{this}}](./{{this}}.md)
{{/each}}
{{/if}}

{{#if issue.blocks}}
## Blocking

This issue blocks:
{{#each issue.blocks}}
- [{{this}}](./{{this}}.md)
{{/each}}
{{/if}}

{{#if issue.children}}
## Subtasks

{{#each issue.children}}
- [{{this}}](./{{this}}.md)
{{/each}}
{{/if}}
`

/**
 * Built-in GitHub-style issue template
 */
const BUILTIN_ISSUE_GITHUB = `---
id: {{issue.id}}
title: "{{issue.title}}"
state: {{issue.status}}
priority: {{issue.priority}}
type: {{issue.type}}
labels: {{#if issue.labels}}[{{#each issue.labels}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}]{{else}}[]{{/if}}
{{#if issue.assignee}}assignee: "{{issue.assignee}}"{{/if}}
---

# {{issue.title}}

{{#if issue.labels}}
{{#each issue.labels}}
![{{this}}](https://img.shields.io/badge/{{this}}-blue)
{{/each}}
{{/if}}

## Description

{{#if issue.description}}
{{issue.description}}
{{else}}
_No description provided._
{{/if}}

{{#if issue.dependsOn}}
## Dependencies

This issue depends on:
{{#each issue.dependsOn}}
- [ ] {{this}}
{{/each}}
{{/if}}

{{#if issue.assignee}}
## Assignee

@{{issue.assignee}}
{{/if}}

---
{{#if issue.createdAt}}
_Created: {{issue.createdAt}}_
{{/if}}
{{#if issue.updatedAt}}
_Last updated: {{issue.updatedAt}}_
{{/if}}
`

/**
 * Built-in Linear-style issue template
 */
const BUILTIN_ISSUE_LINEAR = `---
id: {{issue.id}}
title: "{{issue.title}}"
state: {{issue.status}}
priority: {{issue.priority}}
type: {{issue.type}}
{{#if issue.assignee}}assignee: "{{issue.assignee}}"{{/if}}
{{#if issue.labels}}labels: [{{#each issue.labels}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}]{{/if}}
---

# [{{issue.id}}] {{issue.title}}

{{#if issue.description}}
{{issue.description}}
{{/if}}

---

**Priority:** {{#if (eq issue.priority 0)}}Urgent{{else if (eq issue.priority 1)}}High{{else if (eq issue.priority 2)}}Medium{{else if (eq issue.priority 3)}}Low{{else}}None{{/if}}
**Status:** {{issue.status}}
{{#if issue.assignee}}**Assignee:** {{issue.assignee}}{{/if}}

{{#if issue.dependsOn}}
### Blocked by
{{#each issue.dependsOn}}
- {{this}}
{{/each}}
{{/if}}

{{#if issue.blocks}}
### Blocking
{{#each issue.blocks}}
- {{this}}
{{/each}}
{{/if}}
`

/**
 * Built-in minimal TODO template
 */
const BUILTIN_TODO_MINIMAL = `# TODO

{{#each issues}}
## [{{this.id}}] {{this.title}}

**Status:** {{this.status}} | **Priority:** {{this.priority}} | **Type:** {{this.type}}

{{#if this.description}}
{{this.description}}
{{/if}}

{{/each}}
`

/**
 * Built-in detailed TODO template
 */
const BUILTIN_TODO_DETAILED = `# TODO

Generated: {{timestamp}}

## Summary

- Total Issues: {{issues.length}}
- Open: {{openCount}}
- In Progress: {{inProgressCount}}
- Closed: {{closedCount}}

{{#each issues}}
---

## [{{this.id}}] {{this.title}}

**Status:** {{this.status}} | **Priority:** {{this.priority}} | **Type:** {{this.type}}
{{#if this.assignee}}**Assignee:** {{this.assignee}}{{/if}}

{{#if this.description}}
### Description

{{this.description}}
{{/if}}

{{#if this.dependsOn}}
### Dependencies
{{#each this.dependsOn}}
- [{{this}}](./{{this}}.md)
{{/each}}
{{/if}}

{{/each}}
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
