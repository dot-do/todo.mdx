/**
 * Built-in template presets for todo.mdx
 */

/**
 * Minimal preset - just frontmatter + title + description
 */
const MINIMAL_PRESET = `---
$pattern: "[id]-[title].md"
---
# {issue.title}

{issue.description}
`

/**
 * Detailed preset - full metadata, dependencies, all fields
 */
const DETAILED_PRESET = `---
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
 * GitHub preset - GitHub Issues style with badges, comments section
 */
const GITHUB_PRESET = `---
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
 * Linear preset - Linear.app style with project/cycle placeholders
 */
const LINEAR_PRESET = `---
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
 * Available preset names
 */
export type PresetName = 'minimal' | 'detailed' | 'github' | 'linear'

/**
 * Get a built-in template preset by name
 *
 * @param name - The preset name
 * @returns The template content
 * @throws Error if preset name is unknown
 */
export function getBuiltinPreset(name: string): string {
  if (!name || name.trim() === '') {
    throw new Error('Preset name cannot be empty')
  }

  const normalizedName = name.toLowerCase().trim()

  switch (normalizedName) {
    case 'minimal':
      return MINIMAL_PRESET
    case 'detailed':
      return DETAILED_PRESET
    case 'github':
      return GITHUB_PRESET
    case 'linear':
      return LINEAR_PRESET
    default:
      throw new Error(`Unknown preset: "${name}". Available presets: minimal, detailed, github, linear`)
  }
}

/**
 * Get list of available preset names
 *
 * @returns Array of preset names
 */
export function getPresetNames(): PresetName[] {
  return ['minimal', 'detailed', 'github', 'linear']
}
