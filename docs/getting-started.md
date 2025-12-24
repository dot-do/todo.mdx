# Getting Started with todo.mdx

todo.mdx provides bi-directional sync between the beads issue tracker and markdown files.

## Installation

```bash
npm install todo.mdx
# or
pnpm add todo.mdx
```

## Quick Start

### 1. Initialize your project

```bash
todo.mdx init
```

This creates:
- `.todo/` directory for markdown issue files
- `.beads/TODO.mdx` template (if it doesn't exist)
- Adds `TODO.md` to `.gitignore`

### 2. Create issues with beads

```bash
bd create --title="Add user authentication" --type=feature --priority=1
bd create --title="Fix login bug" --type=bug --priority=0
```

### 3. Sync to markdown files

```bash
todo.mdx sync
```

This creates `.todo/[yyyy-mm-dd] [Title].md` files for each issue. Closed issues are organized in `.todo/closed/` subdirectory.

### 4. Build TODO.md

```bash
todo.mdx build
```

Compiles all issues into a `TODO.md` summary.

### 5. Watch for changes

```bash
todo.mdx watch
```

Automatically syncs when files or beads change.

## File Structure

After setup, your project will look like:

```
your-project/
├── .beads/
│   ├── issues.jsonl      # Beads issue database
│   └── TODO.mdx          # Template (optional)
├── .todo/
│   ├── [2025-12-24] Add user authentication.md
│   ├── [2025-12-24] Fix login bug.md
│   └── closed/
│       └── [2025-12-23] Initial setup.md
└── TODO.md               # Compiled summary
```

## Next Steps

- [API Reference](./api.md) - Programmatic usage
- [Configuration](./configuration.md) - Customize behavior
- [CLI Reference](./cli.md) - All CLI commands
