# CLAUDE.md

This is the development guide for todo.mdx - MDX components that render live data to markdown.

## What is todo.mdx?

**MDX components that render live data to markdown — realtime context for humans AND AI.**

The core insight: README, TODO, ROADMAP, and AI instructions (CLAUDE.md, .cursorrules) are all views of the same data. Define once in MDX, render everywhere.

## How Components Render

`<Issues.Ready/>` in your TODO.mdx:

```mdx
## Ready to Work
<Issues.Ready limit={3} />
```

Renders to markdown showing the next 3 unblocked tasks:

```markdown
## Ready to Work
- [ ] **todo-4fh** [P1]: Create cli.mdx package - MDX-based CLI framework
- [ ] **todo-8mg** [P1]: Export Payload via Workers RPC
- [ ] **todo-3y0** [P1]: Add shadcn dashboard to Payload app
```

This is how AI agents know what to work on next.

## Project Structure

```
todo.mdx/
├── apps/
│   └── todo.mdx.do/       # Payload CMS + Next.js dashboard
├── packages/
│   ├── todo.mdx/          # Core: TODO.mdx → TODO.md + .todo/*.md
│   └── roadmap.mdx/       # ROADMAP.mdx → ROADMAP.md
├── worker/                # Cloudflare Worker (API/MCP/webhooks)
└── .beads/                # Local issue tracking
```

## Architecture

- **Payload CMS** at `apps/todo.mdx.do` - Admin UI + D1 database
- **Cloudflare Worker** - API, MCP server, GitHub webhooks
- **Workers RPC** - Worker accesses Payload via `env.PAYLOAD.payload()`
- **beads** - Local issue tracking that syncs with GitHub Issues

## Commands

```bash
# Development
pnpm dev                    # Start all packages in dev mode
pnpm build                  # Build all packages
pnpm typecheck              # Type check all packages

# Worker
cd worker && pnpm dev       # Start worker locally

# beads (issue tracking)
bd ready                    # Show issues ready to work
bd list --status=open       # All open issues
bd show <id>                # Issue details
bd create --title="..."     # Create issue
bd close <id>               # Close issue
bd sync                     # Sync with remote
```

## Current Work

Check `bd ready` for unblocked tasks. Key areas:

1. **cli.mdx** - MDX-based CLI framework (Bun + React)
2. **Payload integration** - Collections, RPC export
3. **Worker updates** - Use Payload via RPC binding

## Data Flow

```
beads (.beads/) ←→ todo.mdx API ←→ GitHub Issues
       ↓                ↓
   TODO.mdx         Payload CMS
       ↓                ↓
   TODO.md          Dashboard
```

## Key Files

- `packages/todo.mdx/src/compiler.ts` - MDX to markdown compilation
- `packages/todo.mdx/src/parser.ts` - Parse .todo/*.md files
- `worker/src/mcp/index.ts` - MCP server implementation
- `worker/src/do/repo.ts` - Durable Object for sync coordination
