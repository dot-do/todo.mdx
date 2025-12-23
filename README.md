# todo.mdx

**Bi-directional sync between beads issue tracker and markdown files.**

```
.beads/issues.jsonl  <-->  .todo/*.md  -->  TODO.md
```

Issue data lives in one place (beads) but is viewable and editable as markdown files.

## Install

```bash
npm install todo.mdx
# or
pnpm add todo.mdx
```

## Quick Start

```bash
# Initialize todo.mdx in your project
todo.mdx init

# Compile issues to .beads/TODO.md
todo.mdx build

# Bi-directional sync beads <-> .todo/*.md
todo.mdx sync

# Watch mode for live sync
todo.mdx watch
```

## How It Works

### 1. Beads Issues

Issues are stored in `.beads/issues.jsonl` (managed by the [beads](https://github.com/beads-io/beads) issue tracker):

```bash
bd create --title="Add user authentication" --type=feature --priority=1
bd list --status=open
```

### 2. Markdown Files

Each issue becomes a `.todo/{id}-{slug}.md` file:

```markdown
---
id: todo-abc
title: Add user authentication
state: open
type: feature
priority: 1
---

## Description

Implement OAuth 2.0 login with GitHub and Google providers.

## Acceptance Criteria

- [ ] Users can sign in with GitHub
- [ ] Users can sign in with Google
- [ ] Session persists across page refreshes
```

Edit the markdown file directly - changes sync back to beads.

### 3. Compiled Output

`todo.mdx build` compiles all issues into `.beads/TODO.md`:

```markdown
# TODO

## In Progress

- [ ] [#todo-def] Setup CI/CD pipeline - *task, P1*

## Open

### Features

- [ ] [#todo-abc] Add user authentication - *feature, P1*

### Tasks

- [ ] [#todo-xyz] Write API documentation - *task, P2*

## Recently Completed

- [x] [#todo-123] Initial project setup - *closed 2025-12-22*
```

## CLI Commands

```bash
todo.mdx build                        # Compile to TODO.md
todo.mdx build --output README.md     # Custom output path

todo.mdx sync                         # Bi-directional sync
todo.mdx sync --dry-run               # Preview changes
todo.mdx sync --direction beads-to-files  # One-way sync

todo.mdx watch                        # Watch mode for live sync

todo.mdx init                         # Initialize in project
todo.mdx --help                       # Show help
todo.mdx --version                    # Show version
```

## Programmatic API

```typescript
import {
  compile,
  sync,
  watch,
  loadBeadsIssues,
  loadTodoFiles,
  generateTodoFile,
} from 'todo.mdx'

// Compile issues to TODO.md content
const result = await compile()
console.log(result.output) // Markdown string

// Bi-directional sync
const syncResult = await sync({
  conflictStrategy: 'newest-wins', // or 'beads-wins', 'file-wins'
})
console.log(`Created: ${syncResult.created.length}`)
console.log(`Updated: ${syncResult.updated.length}`)

// Watch for changes
const watcher = await watch({
  debounceMs: 300,
  onChange: (event) => console.log(event),
})
// Later: await watcher.close()

// Load issues from beads
const beadsIssues = await loadBeadsIssues()

// Load issues from .todo/*.md files
const fileIssues = await loadTodoFiles()

// Generate markdown for an issue
const markdown = generateTodoFile(issue)
```

## Configuration

Options can be passed to the API functions:

```typescript
interface TodoConfig {
  beads?: boolean           // Enable beads integration (default: true)
  beadsDir?: string         // Path to .beads directory
  todoDir?: string          // Directory for .todo/*.md (default: '.todo')
  conflictStrategy?: 'beads-wins' | 'file-wins' | 'newest-wins'
}
```

## File Format

`.todo/*.md` files use YAML frontmatter:

```yaml
---
id: todo-abc
title: Issue title
state: open | in_progress | closed
type: task | bug | feature | epic
priority: 0-4 (0=critical, 4=backlog)
assignee: username
labels: [label1, label2]
dependsOn: [todo-xyz]
blocks: [todo-def]
---

Markdown description content...
```

## Documentation

- [Getting Started](./docs/getting-started.md)
- [CLI Reference](./docs/cli.md)
- [API Reference](./docs/api.md)
- [Configuration](./docs/configuration.md)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        todo.mdx                              │
│                                                              │
│  ┌─────────────────┐       ┌─────────────────┐             │
│  │ beads-workflows │ <---> │  @mdxld/markdown │             │
│  │   (read/write)  │       │   (parse/gen)    │             │
│  └────────┬────────┘       └────────┬────────┘             │
│           │                         │                       │
│           v                         v                       │
│  ┌─────────────────┐       ┌─────────────────┐             │
│  │ .beads/         │       │ .todo/*.md      │             │
│  │ issues.jsonl    │ <---> │ issue files     │             │
│  └─────────────────┘       └────────┬────────┘             │
│                                     │                       │
│                                     v                       │
│                            ┌─────────────────┐             │
│                            │ TODO.md         │             │
│                            │ (compiled)      │             │
│                            └─────────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

## Dependencies

- **beads-workflows** - Read/write issues from `.beads/issues.jsonl`
- **@mdxld/markdown** - Bi-directional object/markdown conversion
- **chokidar** - File watching for live sync

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build

# Type check
pnpm typecheck
```

## License

MIT
