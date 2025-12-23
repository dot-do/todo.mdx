# Compiler Module

The compiler module provides functionality to compile TODO.md files from beads issues and .todo/*.md files.

## Features

- Loads issues from beads (.beads/issues.jsonl) and .todo/*.md files
- Merges issues with configurable conflict resolution strategies
- Groups issues by status (In Progress, Open, Recently Completed)
- Within Open section, groups by type (Epics, Bugs, Features, Tasks)
- Sorts issues by priority within each group
- Includes metadata: priority, type, assignee, labels
- Configurable completed issue display (enable/disable, limit count)

## API

### `compile(options?: CompileOptions): Promise<CompileResult>`

Main compilation function that loads, merges, and compiles issues.

**Options:**
- `beads?: boolean` - Enable beads integration (default: true)
- `todoDir?: string` - Directory for .todo/*.md files (default: '.todo')
- `conflictStrategy?: 'beads-wins' | 'file-wins' | 'newest-wins'` - Conflict resolution (default: 'beads-wins')
- `includeCompleted?: boolean` - Include completed issues (default: true)
- `completedLimit?: number` - Max completed issues to show (default: 10)

**Returns:** `CompileResult`
- `output: string` - Compiled TODO.md content
- `files: string[]` - Generated file paths (currently empty)
- `issues: TodoIssue[]` - Merged issues used in compilation

**Example:**
```typescript
import { compile } from 'todo.mdx'

const result = await compile({
  todoDir: '.todo',
  conflictStrategy: 'beads-wins',
  includeCompleted: true,
  completedLimit: 10,
})

console.log(result.output)
// Write to file if needed
// await fs.writeFile('TODO.md', result.output)
```

### `compileToString(issues: TodoIssue[], options?: CompileOptions): string`

Pure function that compiles issues to TODO.md markdown string.

**Parameters:**
- `issues: TodoIssue[]` - Array of issues to compile
- `options?: CompileOptions` - Compilation options (only `includeCompleted` and `completedLimit` are used)

**Returns:** `string` - Compiled TODO.md markdown content

**Example:**
```typescript
import { compileToString } from 'todo.mdx'
import type { TodoIssue } from 'todo.mdx'

const issues: TodoIssue[] = [
  {
    id: 'todo-1',
    title: 'Implement feature',
    status: 'open',
    type: 'feature',
    priority: 1,
    assignee: 'alice',
    labels: ['backend'],
  },
]

const markdown = compileToString(issues, {
  includeCompleted: false,
})

console.log(markdown)
```

## Output Format

The compiler generates markdown in the following structure:

```markdown
# TODO

## In Progress
- [ ] [#issue-id] Issue title - *type, P#, @assignee #label1 #label2*

## Open
### Epics
- [ ] [#issue-id] Epic title - *epic, P#*

### Bugs
- [ ] [#issue-id] Bug title - *bug, P#*

### Features
- [ ] [#issue-id] Feature title - *feature, P#*

### Tasks
- [ ] [#issue-id] Task title - *task, P#*

## Recently Completed
- [x] [#issue-id] Completed task - *closed YYYY-MM-DD*
```

## Issue Merging

When issues exist in both beads and .todo/*.md files with the same ID, conflicts are resolved based on the `conflictStrategy`:

- **`beads-wins`** (default): Beads version takes precedence
- **`file-wins`**: File version takes precedence
- **`newest-wins`**: Version with most recent `updatedAt` timestamp wins

## Metadata Formatting

Issue metadata is formatted as:
- **Type and Priority**: Always included (e.g., `feature, P1`)
- **Assignee**: Included if set (e.g., `@alice`)
- **Labels**: Included if set (e.g., `#urgent #security`)

Full example: `*feature, P1, @alice #urgent #security*`

## Sorting

- **In Progress issues**: Sorted by priority (P0 → P4)
- **Open issues**: Grouped by type, then sorted by priority within each type
- **Completed issues**: Sorted by `closedAt` date (most recent first)

## Type Grouping Order

Within the Open section, types are displayed in this order:
1. Epics
2. Bugs
3. Features
4. Tasks

Each type is only shown if there are issues of that type.

## Date Formatting

Closed dates are formatted as `YYYY-MM-DD` (e.g., `2025-12-22`).

## Tests

Comprehensive test suite in `src/__tests__/compiler.test.ts` covering:
- Empty issue lists
- Status-based grouping
- Type-based grouping
- Priority sorting
- Metadata formatting (assignee, labels)
- Completed issue handling
- Issue merging and conflict resolution
- Date formatting

Run tests:
```bash
npm test -- src/__tests__/compiler.test.ts
```
