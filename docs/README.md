# todo.mdx Documentation

Bi-directional sync between beads issue tracker and markdown files.

## Overview

```
.beads/issues.jsonl  <-->  .todo/*.md  -->  TODO.md
```

todo.mdx syncs issues between:
- **beads** - Git-native issue tracker (`.beads/issues.jsonl`)
- **Markdown files** - Human-editable files (`.todo/*.md`)
- **TODO.md** - Compiled summary for easy reading

## Documentation

- [Getting Started](./getting-started.md) - Installation and quick start
- [CLI Reference](./cli.md) - Command-line usage
- [API Reference](./api.md) - Programmatic usage
- [Configuration](./configuration.md) - Options and file formats

## Key Features

- **Bi-directional sync** - Edit in beads or markdown, both stay in sync
- **Conflict resolution** - Choose beads-wins, file-wins, or newest-wins
- **Watch mode** - Auto-sync on file changes
- **Zero config** - Works out of the box with sensible defaults

## Quick Example

```bash
# Initialize
todo.mdx init

# Create an issue in beads
bd create --title="Add login" --type=feature

# Sync to markdown files
todo.mdx sync

# Build TODO.md
todo.mdx build

# Watch for changes
todo.mdx watch
```

## Programmatic Usage

```typescript
import { compile, sync, watch } from 'todo.mdx'

// Compile to markdown
const result = await compile()
console.log(result.output)

// Bi-directional sync
await sync({ conflictStrategy: 'newest-wins' })

// Watch for changes
const watcher = await watch({
  onChange: (event) => console.log(event)
})
```

## Links

- [GitHub Repository](https://github.com/dot-do/todo.mdx)
- [npm Package](https://www.npmjs.com/package/todo.mdx)
- [beads Issue Tracker](https://github.com/beads-io/beads)
