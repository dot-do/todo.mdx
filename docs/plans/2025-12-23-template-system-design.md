# Template System & mdxld Integration Design

**Date:** 2025-12-23
**Status:** Approved

## Overview

Implement a flexible template system for TODO.mdx and [Issue].mdx files with full mdxld integration for bi-directional sync between beads and markdown.

## Goals

1. **Preset layouts** - Built-in templates (minimal, detailed, github, linear)
2. **Component-based** - MDX components for composable templates
3. **Full customization** - User-authored templates with variable interpolation
4. **Filename patterns** - Configurable output filenames with smart slugification
5. **mdxld integration** - Replace custom parser/generator with @mdxld/markdown and @mdxld/extract

## Template Architecture

### Template Resolution Chain

```
.mdx/[Issue].mdx           → project custom
.mdx/presets/detailed.mdx  → local preset override
preset: "detailed"         → from config
built-in minimal           → fallback
```

### Template Frontmatter

```mdx
---
$pattern: "[id]-[title].md"      # filename pattern
$output: ".todo"                  # output directory
---

# {issue.title}

**Status:** {issue.status} | **Priority:** P{issue.priority}

{issue.description}

<Dependencies issue={issue} />
```

### Built-in Presets

- `minimal` - Frontmatter + title + description only
- `detailed` - Full metadata, dependencies, timeline
- `github` - GitHub Issues style with label badges
- `linear` - Linear.app style with project/cycle

## Filename Patterns

### Token Reference

| Token | Example Value | With `-` delimiter | With ` ` delimiter |
|-------|---------------|-------------------|-------------------|
| `[id]` | `todo-abc` | `todo-abc` | `todo-abc` |
| `[title]` | `Add User Auth` | `add-user-auth` | `Add User Auth` |
| `[Title]` | `Add User Auth` | `Add-User-Auth` | `Add User Auth` |
| `[yyyy-mm-dd]` | `2025-12-23` | `2025-12-23` | `2025-12-23` |
| `[type]` | `feature` | `feature` | `feature` |
| `[priority]` | `1` | `1` | `1` |
| `[assignee]` | `alice` | `alice` | `alice` |

### Pattern Examples

```yaml
# Standard (current default)
$pattern: "[id]-[title].md"
# → todo-abc-add-user-auth.md

# Date-prefixed journal style
$pattern: "[yyyy-mm-dd] [Title].md"
# → 2025-12-23 Add User Auth.md

# Organized by type
$pattern: "[type]/[id]-[title].md"
# → feature/todo-abc-add-user-auth.md

# Priority-first
$pattern: "P[priority]/[id].md"
# → P1/todo-abc.md
```

## mdxld Integration

### Current → New

| Current | New |
|---------|-----|
| Custom `parseFrontmatter()` | `fromMarkdown()` from @mdxld/markdown |
| Custom `generateFrontmatter()` + `generateBody()` | `toMarkdown()` with templates |
| Manual equality check | `diff()` for smart conflict detection |
| N/A | `applyExtract()` for merging changes |

### Core Functions

```typescript
import { toMarkdown, fromMarkdown, diff, applyExtract } from '@mdxld/markdown'
import { extract, parseTemplateSlots } from '@mdxld/extract'

// Render issue to markdown
function renderIssue(issue: TodoIssue, template: string): string

// Parse markdown to issue
function parseIssue(markdown: string): TodoIssue

// Detect changes between versions
function detectChanges(beads: TodoIssue, file: TodoIssue): DiffResult

// Apply file changes to beads issue
function mergeChanges(beads: TodoIssue, file: TodoIssue): TodoIssue
```

## Edge Cases to Test

### Parsing
- Empty frontmatter
- Missing required fields
- Malformed YAML
- Unicode titles
- Special chars in ID
- Duplicate IDs
- Very long titles (truncation)

### Sync
- Concurrent edits (conflict detection)
- Deleted in beads vs file exists
- Deleted file vs beads exists
- Renamed/moved files
- Circular dependencies
- Orphan dependency references

### Templates
- Missing template slots
- Nested object access
- Array rendering
- Conditional sections
- Unknown components

### Round-trip Fidelity
- Unknown frontmatter fields preserved
- Markdown formatting preserved
- Whitespace consistency
- Date format consistency
- Array ordering maintained

### Filename Patterns
- Special chars in title (slashes, dots)
- Empty title handling
- Date tokens on open issues
- Filename collisions

## Test File Structure

```
tests/
├── mdxld-integration.test.ts    # @mdxld/markdown round-trips
├── template-rendering.test.ts   # Template slot resolution
├── template-extraction.test.ts  # Extract from rendered
├── filename-patterns.test.ts    # Pattern parsing & generation
├── sync-edge-cases.test.ts      # Conflict scenarios
├── parser-edge-cases.test.ts    # (expand existing)
└── generator-edge-cases.test.ts # (expand existing)
```

## Implementation Phases

### Phase 1: mdxld Integration
1. Replace parser with @mdxld/markdown fromMarkdown()
2. Replace generator with @mdxld/markdown toMarkdown()
3. Add diff() and applyExtract() to sync
4. Full round-trip test coverage

### Phase 2: Filename Patterns
1. Pattern token parser
2. Slugification with delimiter awareness
3. Reverse pattern matching (filename → ID)
4. Collision handling

### Phase 3: Template System
1. Template resolution chain
2. Built-in presets (minimal, detailed, github, linear)
3. Template slot interpolation
4. MDX component support

### Phase 4: Edge Case Hardening
1. All parsing edge cases
2. All sync edge cases
3. All template edge cases
4. Round-trip fidelity tests
