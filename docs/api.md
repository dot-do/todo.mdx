# API Reference

todo.mdx exports functions for programmatic use.

## Core Functions

### `compile(options?)`

Compiles issues from beads and `.todo/*.md` files into TODO.md content.

```typescript
import { compile } from 'todo.mdx'

const result = await compile({
  todoDir: '.todo',
  beads: true,
  includeCompleted: true,
  completedLimit: 10,
})

console.log(result.output)    // Markdown string
console.log(result.issues)    // Array of TodoIssue
console.log(result.files)     // Generated file paths
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `todoDir` | string | `.todo` | Directory for .todo/*.md files |
| `beads` | boolean | `true` | Load issues from beads |
| `beadsDir` | string | auto | Path to .beads directory |
| `includeCompleted` | boolean | `true` | Include closed issues |
| `completedLimit` | number | `10` | Max completed issues to show |
| `conflictStrategy` | string | `beads-wins` | Conflict resolution |

### `compileToString(issues, options?)`

Pure function that compiles issues to markdown.

```typescript
import { compileToString } from 'todo.mdx'

const markdown = compileToString(issues, {
  includeCompleted: true,
  completedLimit: 5,
})
```

### `sync(options?)`

Bi-directional sync between beads and `.todo/*.md` files.

```typescript
import { sync } from 'todo.mdx'

const result = await sync({
  todoDir: '.todo',
  conflictStrategy: 'newest-wins',
  dryRun: false,
  direction: 'bidirectional',
})

console.log(result.created)       // IDs of created issues
console.log(result.updated)       // IDs of updated issues
console.log(result.filesWritten)  // Paths of written files
console.log(result.conflicts)     // Detected conflicts
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dryRun` | boolean | `false` | Preview without writing |
| `direction` | string | `bidirectional` | Sync direction |
| `conflictStrategy` | string | `newest-wins` | Conflict resolution |

**Direction options:**
- `bidirectional` - Sync both ways
- `beads-to-files` - Only update files from beads
- `files-to-beads` - Only update beads from files

### `detectChanges(beadsIssues, fileIssues)`

Detect what changes need to be synced.

```typescript
import { detectChanges } from 'todo.mdx'

const { toBeads, toFiles, conflicts } = detectChanges(
  beadsIssues,
  fileIssues
)
```

### `watch(options?)`

Watch for file changes and auto-sync.

```typescript
import { watch } from 'todo.mdx'

const watcher = await watch({
  todoDir: '.todo',
  debounceMs: 300,
  onChange: (event) => {
    console.log(event.type, event.path)
  },
})

// Later...
await watcher.close()
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `debounceMs` | number | `300` | Debounce delay in ms |
| `onChange` | function | - | Callback for events |

## File Operations

### `loadBeadsIssues(dir?)`

Load issues from beads database.

```typescript
import { loadBeadsIssues } from 'todo.mdx'

const issues = await loadBeadsIssues('/path/to/project')
```

### `hasBeadsDirectory(dir?)`

Check if a beads directory exists.

```typescript
import { hasBeadsDirectory } from 'todo.mdx'

if (await hasBeadsDirectory()) {
  // beads is initialized
}
```

### `parseTodoFile(content)`

Parse a `.todo/*.md` file content.

```typescript
import { parseTodoFile } from 'todo.mdx'

const { frontmatter, content, issue } = parseTodoFile(markdown)
```

### `loadTodoFiles(dir?)`

Load all issues from `.todo/*.md` files.

```typescript
import { loadTodoFiles } from 'todo.mdx'

const issues = await loadTodoFiles('.todo')
```

### `generateTodoFile(issue)`

Generate markdown content for an issue.

```typescript
import { generateTodoFile } from 'todo.mdx'

const markdown = generateTodoFile(issue)
```

### `writeTodoFiles(issues, dir?)`

Write issues to `.todo/*.md` files.

```typescript
import { writeTodoFiles } from 'todo.mdx'

await writeTodoFiles(issues, '.todo')
```

## Types

### `TodoIssue`

```typescript
interface TodoIssue {
  id: string
  title: string
  description?: string
  status: 'open' | 'in_progress' | 'closed'
  type: 'task' | 'bug' | 'feature' | 'epic'
  priority: 0 | 1 | 2 | 3 | 4  // 0=critical, 4=backlog
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

### `TodoConfig`

```typescript
interface TodoConfig {
  beads?: boolean
  beadsDir?: string
  todoDir?: string
  templateDir?: string
  filePattern?: string
  watch?: boolean
  conflictStrategy?: 'beads-wins' | 'file-wins' | 'newest-wins'
}
```

### `SyncResult`

```typescript
interface SyncResult {
  created: string[]
  updated: string[]
  deleted: string[]
  filesWritten: string[]
  conflicts: SyncConflict[]
}
```

### `CompileResult`

```typescript
interface CompileResult {
  output: string
  files: string[]
  issues: TodoIssue[]
}
```
