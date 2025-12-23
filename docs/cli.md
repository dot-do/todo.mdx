# CLI Reference

todo.mdx provides a command-line interface for common operations.

## Commands

### `todo.mdx build`

Compile issues to TODO.md.

```bash
todo.mdx build
todo.mdx build --output docs/TODO.md
```

**Options:**
| Option | Description |
|--------|-------------|
| `--output <path>` | Custom output path (default: `TODO.md`) |

**Output:**
- Loads issues from beads and `.todo/*.md`
- Merges and deduplicates
- Writes formatted TODO.md

### `todo.mdx sync`

Bi-directional sync between beads and files.

```bash
todo.mdx sync
todo.mdx sync --dry-run
todo.mdx sync --direction beads-to-files
```

**Options:**
| Option | Description |
|--------|-------------|
| `--dry-run` | Preview changes without writing |
| `--direction <dir>` | Sync direction: `bidirectional`, `beads-to-files`, `files-to-beads` |

**Output:**
```
todo.mdx sync

Sync complete:
  Created: 2 issues
  Updated: 3 issues
  Files written: 5
  Conflicts: 0
```

### `todo.mdx watch`

Watch for changes and auto-sync.

```bash
todo.mdx watch
```

Monitors:
- `.beads/issues.jsonl` for beads changes
- `.todo/*.md` for file changes

Press `Ctrl+C` to stop.

### `todo.mdx init`

Initialize todo.mdx in your project.

```bash
todo.mdx init
```

Creates:
- `.todo/` directory
- `TODO.mdx` template
- Adds `TODO.md` to `.gitignore`

### `todo.mdx --help`

Show help message.

```bash
todo.mdx --help
```

### `todo.mdx --version`

Show version.

```bash
todo.mdx --version
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error occurred |

## Examples

### Daily workflow

```bash
# Start of day - sync latest changes
todo.mdx sync

# Work on issues...
bd update todo-abc --status=in_progress

# End of day - rebuild TODO.md
todo.mdx build
git add TODO.md .todo/
git commit -m "Update TODO"
```

### CI/CD integration

```bash
# In CI pipeline
todo.mdx sync --direction beads-to-files
todo.mdx build

# Check if TODO.md is up to date
git diff --exit-code TODO.md
```

### Watch mode development

```bash
# Terminal 1: Watch for changes
todo.mdx watch

# Terminal 2: Work on issues
bd create --title="New feature" --type=feature
# Files automatically sync...

bd close todo-xyz
# TODO.md automatically updates...
```
