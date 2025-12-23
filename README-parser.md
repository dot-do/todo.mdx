# todo.mdx Parser

The parser module for todo.mdx provides functions to parse `.todo/*.md` files and extract issue data.

## Features

- Parse YAML frontmatter from markdown files
- Extract issue metadata (id, title, status, priority, type, labels, etc.)
- Load multiple files from a directory
- Handle errors gracefully
- Full TypeScript support

## Installation

```bash
pnpm add todo.mdx
```

## Usage

### Parse a single file

```typescript
import { parseTodoFile } from 'todo.mdx'

const content = `---
id: todo-123
title: "Fix authentication bug"
state: open
priority: 3
type: bug
labels: [security, urgent]
---

# Fix authentication bug

Users are unable to log in with OAuth2.
`

const parsed = parseTodoFile(content)

console.log(parsed.issue.id)        // "todo-123"
console.log(parsed.issue.title)     // "Fix authentication bug"
console.log(parsed.issue.status)    // "open"
console.log(parsed.issue.type)      // "bug"
console.log(parsed.issue.priority)  // 3
console.log(parsed.issue.labels)    // ["security", "urgent"]
```

### Load all files from a directory

```typescript
import { loadTodoFiles } from 'todo.mdx'
import { join } from 'path'

const todoDir = join(process.cwd(), '.todo')
const issues = await loadTodoFiles(todoDir)

console.log(`Loaded ${issues.length} issues`)

// Filter by status
const openIssues = issues.filter(i => i.status === 'open')
console.log(`${openIssues.length} open issues`)

// Group by type
const byType = issues.reduce((acc, issue) => {
  acc[issue.type] = (acc[issue.type] || 0) + 1
  return acc
}, {})
```

## File Format

Todo files use YAML frontmatter with markdown content:

```markdown
---
id: todo-abc
title: "Issue title"
state: open              # or: closed, in_progress, in-progress
priority: 2              # 0-4 (0=lowest, 4=highest)
type: task               # task, bug, feature, epic
labels: [tag1, tag2]     # optional array
assignee: user@email.com # optional
dependsOn: [todo-123]    # optional dependencies
blocks: [todo-456]       # optional blocks
parent: todo-789         # optional parent (for epics)
---

# Issue title

Markdown content here becomes the description.

## Details

- First point
- Second point
```

## Field Mapping

The parser automatically maps fields from the frontmatter:

| Frontmatter Field | TodoIssue Field | Notes |
|-------------------|-----------------|-------|
| `id` | `id` | Required, unique identifier |
| `title` | `title` | Required, issue title |
| `state` | `status` | Maps to `open`, `in_progress`, or `closed` |
| `priority` | `priority` | 0-4, defaults to 2 |
| `type` | `type` | `task`, `bug`, `feature`, or `epic` |
| `labels` | `labels` | Array of strings |
| `assignee` | `assignee` | Email or username |
| `dependsOn` | `dependsOn` | Array of issue IDs |
| `blocks` | `blocks` | Array of issue IDs |
| `parent` | `parent` | Parent issue ID |
| `children` | `children` | Array of child issue IDs |
| (body) | `description` | Markdown content |

### State Mapping

The `state` field in frontmatter is mapped to `status`:

- `open` → `open`
- `closed`, `done`, `completed` → `closed`
- `in_progress`, `in-progress`, `working` → `in_progress`

## API Reference

### `parseTodoFile(content: string): ParsedTodoFile`

Parses a single markdown file with frontmatter.

**Parameters:**
- `content` - The file content to parse

**Returns:** `ParsedTodoFile` object containing:
- `frontmatter` - Raw frontmatter as key-value pairs
- `content` - Markdown body content
- `issue` - Extracted `TodoIssue` object

### `loadTodoFiles(todoDir: string): Promise<TodoIssue[]>`

Loads all `.md` files from a directory and parses them.

**Parameters:**
- `todoDir` - Path to the `.todo` directory

**Returns:** Promise resolving to array of `TodoIssue` objects

**Error Handling:**
- Returns empty array if directory doesn't exist
- Logs warning for files that fail to parse
- Continues processing other files on error

## Types

### `TodoIssue`

```typescript
interface TodoIssue {
  id: string
  title: string
  description?: string
  status: 'open' | 'in_progress' | 'closed'
  type: 'task' | 'bug' | 'feature' | 'epic'
  priority: 0 | 1 | 2 | 3 | 4
  assignee?: string
  labels?: string[]
  createdAt?: string
  updatedAt?: string
  closedAt?: string
  dependsOn?: string[]
  blocks?: string[]
  parent?: string
  children?: string[]
  source?: 'beads' | 'file'
}
```

### `ParsedTodoFile`

```typescript
interface ParsedTodoFile {
  frontmatter: Record<string, unknown>
  content: string
  issue: TodoIssue
}
```

## Examples

See [examples/parser-example.ts](examples/parser-example.ts) for a complete working example.

## Testing

The parser includes comprehensive tests:

```bash
pnpm test
```

Tests cover:
- Basic frontmatter parsing
- Array parsing
- State mapping
- Type normalization
- Priority normalization
- Quoted strings
- Dependency arrays
- Error handling
- Integration with real files
