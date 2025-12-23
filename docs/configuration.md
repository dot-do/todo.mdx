# Configuration

todo.mdx can be configured through options passed to functions or CLI flags.

## Configuration Options

### `todoDir`

Directory for `.todo/*.md` files.

- **Type:** `string`
- **Default:** `.todo`

```typescript
await compile({ todoDir: 'issues' })
```

### `beads`

Enable/disable beads integration.

- **Type:** `boolean`
- **Default:** `true`

```typescript
await compile({ beads: false })  // Only use .todo/*.md files
```

### `beadsDir`

Path to `.beads` directory. Auto-detected if not specified.

- **Type:** `string`
- **Default:** auto-detected

```typescript
await compile({ beadsDir: '/custom/path/.beads' })
```

### `conflictStrategy`

How to resolve conflicts when the same issue exists in both beads and files with different values.

- **Type:** `'beads-wins' | 'file-wins' | 'newest-wins'`
- **Default:** `'beads-wins'`

| Strategy | Description |
|----------|-------------|
| `beads-wins` | Beads version always wins |
| `file-wins` | File version always wins |
| `newest-wins` | Most recently updated version wins |

```typescript
await sync({ conflictStrategy: 'newest-wins' })
```

### `includeCompleted`

Include completed/closed issues in output.

- **Type:** `boolean`
- **Default:** `true`

```typescript
await compile({ includeCompleted: false })
```

### `completedLimit`

Maximum number of completed issues to show.

- **Type:** `number`
- **Default:** `10`

```typescript
await compile({ completedLimit: 5 })
```

### `debounceMs`

Debounce delay for file watcher.

- **Type:** `number`
- **Default:** `300`

```typescript
await watch({ debounceMs: 500 })
```

## File Format

### `.todo/*.md` Format

Issue files use YAML frontmatter:

```yaml
---
id: todo-abc
title: "Issue title"
state: open
type: task
priority: 2
assignee: "username"
labels: ["urgent", "backend"]
dependsOn: ["todo-xyz"]
blocks: ["todo-def"]
createdAt: "2025-12-22T10:00:00Z"
updatedAt: "2025-12-23T15:30:00Z"
---

# Issue title

Description content goes here...

## Acceptance Criteria

- [ ] First criterion
- [ ] Second criterion
```

### Field Mapping

| YAML Field | TodoIssue Field | Notes |
|------------|-----------------|-------|
| `id` | `id` | Required |
| `title` | `title` | Required |
| `state` | `status` | `open`, `in_progress`, `closed` |
| `type` | `type` | `task`, `bug`, `feature`, `epic` |
| `priority` | `priority` | 0-4 (0=critical) |
| `assignee` | `assignee` | Username string |
| `labels` | `labels` | Array of strings |
| `dependsOn` | `dependsOn` | Array of issue IDs |
| `blocks` | `blocks` | Array of issue IDs |

### State Aliases

The parser accepts these aliases for `state`:

| Input | Normalized |
|-------|------------|
| `open` | `open` |
| `in_progress` | `in_progress` |
| `in-progress` | `in_progress` |
| `closed` | `closed` |
| `done` | `closed` |
| `completed` | `closed` |

### Priority Values

| Priority | Meaning |
|----------|---------|
| 0 | Critical |
| 1 | High |
| 2 | Medium (default) |
| 3 | Low |
| 4 | Backlog |

## TODO.md Output Format

The compiled `TODO.md` follows this structure:

```markdown
# TODO

## In Progress

- [ ] [#todo-abc] Active task - *task, P1, @alice*

## Open

### Epics

- [ ] [#todo-epic] Big feature - *epic, P0*

### Bugs

- [ ] [#todo-bug] Fix issue - *bug, P1 #urgent*

### Features

- [ ] [#todo-feat] New feature - *feature, P2*

### Tasks

- [ ] [#todo-task] Simple task - *task, P3*

## Recently Completed

- [x] [#todo-done] Finished - *closed 2025-12-22*
```

## Environment Variables

todo.mdx doesn't currently use environment variables, but respects standard Node.js variables like `NODE_ENV`.
