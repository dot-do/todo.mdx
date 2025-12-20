# File Watcher

The `watch()` function enables bidirectional sync between `.todo/*.md` files and beads.

## Usage

### CLI

```bash
# Start watch mode
npx todo.mdx --watch

# With verbose output
npx todo.mdx --watch
```

### Programmatic API

```typescript
import { watch } from '@todo.mdx/core'

// Start watching .todo directory
const stopWatcher = await watch({
  todoDir: '.todo',
  debounceMs: 500,
  verbose: true,
  onEvent: (event) => {
    console.log(`${event.action}: ${event.path}`)
  }
})

// Stop watching
await stopWatcher()
```

## How It Works

1. **Initial Load**: When started, the watcher builds a cache of all `.todo/*.md` files
2. **Change Detection**: When a file changes, it parses the frontmatter and body
3. **Diff Calculation**: Compares the new state with the cached state to detect changes
4. **Sync to Beads**: Uses `beads-workflows` SDK to update the corresponding beads issue
5. **Cache Update**: Updates the cache with the new state

## Synced Fields

The watcher syncs these fields from `.todo/*.md` files to beads:

- `status` (open, in_progress, closed) - Note: 'blocked' state maps to 'open' in beads
- `priority` (0-4)
- `title`
- `description` (from file body)
- `labels` (array)
- `assignee` (first assignee from assignees array)

## Frontmatter Format

Each `.todo/*.md` file should include a `beadsId` in the frontmatter:

```yaml
---
id: todo-123
beadsId: todo-123
title: "My Task"
state: open
priority: 2
labels: [feature, frontend]
assignees: [user1]
---

Task description goes here...
```

## Debouncing

Changes are debounced (default 500ms) to prevent rapid successive updates:

```typescript
await watch({
  debounceMs: 1000, // Wait 1 second before syncing
})
```

## Event Callbacks

Listen to sync events:

```typescript
await watch({
  onEvent: (event) => {
    if (event.action === 'updated') {
      console.log(`Synced ${event.issueId}`)
    } else if (event.action === 'error') {
      console.error(`Error: ${event.error}`)
    }
  }
})
```

Event types:
- `add` - New file detected
- `change` - File modified
- `unlink` - File deleted

Action types:
- `created` - Initial file tracking
- `updated` - Synced changes to beads
- `deleted` - File removed (issue not auto-closed)
- `error` - Sync failed

## File Deletion

When a `.todo/*.md` file is deleted, the watcher:
1. Logs the deletion
2. Removes it from the cache
3. **Does NOT** automatically close the beads issue

This prevents accidental data loss. To close an issue, update its status to 'closed' before deleting the file.
