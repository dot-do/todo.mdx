# Generator Module

The generator module converts `TodoIssue` objects into markdown files with YAML frontmatter.

## Functions

### `generateTodoFile(issue: TodoIssue): string`

Generates a complete markdown file content from a TodoIssue object.

**Output format:**
```markdown
---
id: todo-abc
title: "Issue title"
state: open
priority: 2
type: task
labels: ["bug", "urgent"]
createdAt: "2024-01-01T00:00:00Z"
updatedAt: "2024-01-02T00:00:00Z"
---

# Issue title

Description content here...

### Related Issues

**Depends on:**
- **todo-xyz**

**Blocks:**
- **todo-def**

### Timeline

- **Created:** 01/01/2024
- **Updated:** 01/02/2024
```

### `writeTodoFiles(issues: TodoIssue[], todoDir?: string): Promise<string[]>`

Writes multiple TodoIssue objects to `.todo/*.md` files.

**Parameters:**
- `issues`: Array of TodoIssue objects to write
- `todoDir`: Directory to write files to (default: `.todo`)

**Returns:** Promise resolving to array of written file paths (absolute paths)

**Filename pattern:** `{id}-{title-slug}.md`
- Example: `todo-abc-implement-user-authentication.md`

## Example Usage

```typescript
import { generateTodoFile, writeTodoFiles } from 'todo.mdx'

// Generate single file content
const issue = {
  id: 'todo-001',
  title: 'Implement User Authentication',
  description: 'Add JWT-based authentication',
  status: 'in_progress',
  priority: 1,
  type: 'feature',
  labels: ['auth', 'security'],
}

const markdown = generateTodoFile(issue)
console.log(markdown)

// Write multiple files
const issues = [issue1, issue2, issue3]
const paths = await writeTodoFiles(issues, '.todo')
console.log('Written files:', paths)
```

## Field Mapping

### Frontmatter Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Issue identifier |
| `title` | string | Yes | Issue title |
| `state` | string | Yes | Status: `open`, `in_progress`, `closed` |
| `priority` | number | Yes | Priority level: 0-4 |
| `type` | string | Yes | Type: `task`, `bug`, `feature`, `epic` |
| `labels` | array | No | Array of label strings |
| `assignee` | string | No | Assigned user |
| `createdAt` | string | No | ISO 8601 timestamp |
| `updatedAt` | string | No | ISO 8601 timestamp |
| `closedAt` | string | No | ISO 8601 timestamp |
| `parent` | string | No | Parent issue ID |
| `source` | string | No | Source system: `beads`, `file` |

### Body Sections

1. **H1 Heading**: Issue title
2. **Description**: Main content from `description` field
3. **Related Issues** (if dependencies exist):
   - **Depends on**: Issues this depends on
   - **Blocks**: Issues this blocks
   - **Children**: Child issues (for epics)
4. **Timeline**: Creation, update, and closure dates

## Slugification

Titles are slugified for filenames:
- Converted to lowercase
- Spaces replaced with hyphens
- Special characters removed
- Leading/trailing hyphens removed

Examples:
- "Implement User Auth" → `implement-user-auth`
- "Fix: Memory Leak" → `fix-memory-leak`
- "Add OAuth 2.0 Support" → `add-oauth-20-support`

## YAML Serialization

The generator handles special characters in YAML values:
- Strings with special chars (`:`, `#`, `"`) are quoted
- Double quotes in strings are escaped
- Arrays use JSON-style formatting: `["item1", "item2"]`
- Empty arrays rendered as `[]`
