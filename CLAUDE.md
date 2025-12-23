# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is todo.mdx?

Bi-directional sync between beads issue tracker and markdown files.

```
.beads/issues.jsonl  ←→  .todo/*.md  →  TODO.md
```

The core insight: Issue data should live in one place (beads) but be viewable and editable as markdown files.

## Commands

```bash
# Development
pnpm install            # Install dependencies
pnpm build              # Build the package
pnpm dev                # Watch mode
pnpm test               # Run tests
pnpm typecheck          # Type check

# CLI (after build)
todo.mdx build          # Compile → TODO.md
todo.mdx sync           # Bi-directional sync beads ↔ .todo/*.md
todo.mdx watch          # Watch mode for live sync
todo.mdx init           # Initialize TODO.mdx in project

# Issue tracking (beads)
bd ready                # Show issues ready to work (no blockers)
bd list --status=open   # All open issues
bd show <id>            # Issue details with dependencies
bd create --title="..." # Create issue
bd close <id>           # Close issue
bd sync                 # Sync with git remote
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        todo.mdx                              │
│                                                              │
│  ┌─────────────────┐       ┌─────────────────┐             │
│  │ beads-workflows │ ←───→ │  @mdxld/markdown │             │
│  │   (read/write)  │       │   (parse/gen)    │             │
│  └────────┬────────┘       └────────┬────────┘             │
│           │                         │                       │
│           ▼                         ▼                       │
│  ┌─────────────────┐       ┌─────────────────┐             │
│  │ .beads/         │       │ .todo/*.md      │             │
│  │ issues.jsonl    │ ←───→ │ issue files     │             │
│  └─────────────────┘       └────────┬────────┘             │
│                                     │                       │
│                                     ▼                       │
│                            ┌─────────────────┐             │
│                            │ TODO.md         │             │
│                            │ (compiled)      │             │
│                            └─────────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **beads → .todo/*.md**: Issues from `.beads/issues.jsonl` are rendered as individual markdown files
2. **.todo/*.md → beads**: Edits to markdown files are synced back to beads via `bd update`
3. **.beads/TODO.mdx → TODO.md**: Template is hydrated with issue data to generate summary view

## Project Structure

```
todo.mdx/
├── src/
│   ├── index.ts        # Main exports
│   ├── types.ts        # TypeScript interfaces
│   ├── beads.ts        # Read issues from beads-workflows
│   ├── parser.ts       # Parse .todo/*.md files
│   ├── generator.ts    # Generate .todo/*.md files
│   ├── compiler.ts     # Compile TODO.mdx → TODO.md
│   ├── sync.ts         # Bi-directional sync logic
│   ├── watcher.ts      # File watching for live sync
│   └── cli.ts          # CLI commands
├── .beads/             # Issue tracking database
├── .todo/              # Generated issue markdown files
├── .beads/TODO.mdx     # Template for TODO.md
├── TODO.md             # Compiled output
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## Key Dependencies

- **beads-workflows** - Read/write issues from .beads/issues.jsonl
- **@mdxld/markdown** - Bi-directional object ↔ markdown conversion
- **@mdxld/extract** - Extract structured data from rendered content
- **chokidar** - File watching for live sync

## Testing

- Uses **vitest** for unit tests
- Run tests: `pnpm test`
- Watch mode: `pnpm test:watch`

## Development Guidelines

- Use TypeScript strict mode
- Prefer functional programming patterns
- Use conventional commits for commit messages
- Track issues with `bd` (beads) - check `bd ready` for unblocked tasks
- Follow TDD: write failing test, make it pass, refactor
