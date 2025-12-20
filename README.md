# TODO.mdx

**MDX components that render live data to markdown — realtime context for humans AND AI.**

```mdx
<!-- TODO.mdx -->
# Project Status

<Stats />           <!-- "12 open, 3 blocked, 5 ready" -->

## Ready to Work
<Issues.Ready />    <!-- Live list of unblocked issues -->

## Roadmap
<Roadmap />         <!-- Milestones with progress bars -->
```

Compiles to `TODO.md` with live data from beads, GitHub Issues, and your API.

## The Insight

Your README, TODO, ROADMAP, and AI instructions (CLAUDE.md, .cursorrules) are all **views of the same data**. Instead of manually keeping them in sync, define them once in MDX and render everywhere.

```
AGENTS.mdx  →  CLAUDE.md + .cursorrules + .github/copilot-instructions.md
TODO.mdx    →  TODO.md + .todo/*.md files
ROADMAP.mdx →  ROADMAP.md + .roadmap/*.md files
README.mdx  →  README.md (with live stats, badges, API docs)
```

**One source. Multiple outputs. Always current.**

## How It Works

Write your TODO in MDX with live components:

```mdx
<!-- TODO.mdx -->
# Project Status

<Stats />

## Ready to Work
<Issues.Ready limit={3} />

## Blocked
<Issues.Blocked />
```

Compiles to plain markdown with real data:

```markdown
# Project Status

12 open · 3 blocked · 5 ready · 68% complete

## Ready to Work
- [ ] **todo-4fh** [P1]: Create cli.mdx package - MDX-based CLI framework
- [ ] **todo-8mg** [P1]: Export Payload via Workers RPC
- [ ] **todo-3y0** [P1]: Add shadcn dashboard to Payload app

## Blocked
- [ ] **todo-6a9** [P1]: Create claude.mdx CLI package
  - ⛔ Blocked by: todo-4fh (Create cli.mdx package)
- [ ] **todo-izz** [P1]: Update worker to use Payload RPC binding
  - ⛔ Blocked by: todo-8mg (Export Payload via Workers RPC)
```

AI agents read this and know exactly what to work on next. Humans read it and see project status at a glance. Same data, rendered for the audience.

## Packages

| Package | Description |
|---------|-------------|
| [todo.mdx](./packages/todo.mdx) | `TODO.mdx` → `TODO.md` + `.todo/*.md` ↔ GitHub Issues ↔ beads |
| [roadmap.mdx](./packages/roadmap.mdx) | `ROADMAP.mdx` → `ROADMAP.md` ↔ GitHub Milestones ↔ beads epics |
| cli.mdx *(planned)* | MDX-based CLI framework (Bun + React → terminal + markdown) |
| readme.mdx *(planned)* | `README.mdx` → `README.md` with live stats |
| agents.mdx *(planned)* | `AGENTS.mdx` → `CLAUDE.md` + `.cursorrules` |
| claude.mdx *(planned)* | CLI to dispatch Claude Code sessions for TODOs |

## Quick Start

```bash
# Initialize TODO.mdx in your project
npx todo.mdx init

# Compile to TODO.md
npx todo.mdx

# Generate .todo/*.md files from issues
npx todo.mdx --generate

# Start MCP server for Claude Desktop
npx todo.mdx --mcp
```

## Components

### Issues

```mdx
<Issues.Open />           <!-- All open issues -->
<Issues.Closed />         <!-- Completed issues -->
<Issues.Ready />          <!-- No blockers, ready to work -->
<Issues.Blocked />        <!-- Blocked by dependencies -->
<Issues.InProgress />     <!-- Currently being worked -->
```

### Stats

```mdx
<Stats />                 <!-- "12 open · 3 closed · 80% complete" -->
<Stats.Progress />        <!-- Progress bar -->
<Stats.Burndown />        <!-- Burndown chart (planned) -->
```

### Roadmap

```mdx
<Roadmap />               <!-- All milestones with issues -->
<Milestone id="v1.0" />   <!-- Single milestone -->
<Timeline />              <!-- Gantt-style view (planned) -->
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        todo.mdx.do                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Payload CMS │  │  Dashboard  │  │   Cloudflare Worker │ │
│  │   (Admin)   │  │  (Next.js)  │  │  (API/MCP/Webhooks) │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│         │                │                    │             │
│         └────────────────┼────────────────────┘             │
│                          │                                  │
│                    ┌─────▼─────┐                           │
│                    │    D1     │                           │
│                    │ (SQLite)  │                           │
│                    └───────────┘                           │
└─────────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
    ┌─────────┐      ┌──────────┐     ┌───────────┐
    │  beads  │      │  GitHub  │     │ Linear    │
    │ (local) │      │  Issues  │     │ (planned) │
    └─────────┘      └──────────┘     └───────────┘
```

## Data Sources

- **beads** — Local issue tracking (`.beads/` directory)
- **GitHub Issues** — Synced via GitHub App webhooks
- **GitHub Milestones** — Mapped to roadmap
- **Linear** — *(planned)* Two-way sync with Linear issues
- **todo.mdx API** — REST + MCP for remote access

## Configuration

```mdx
---
title: My Project TODO
beads: true
filePattern: "[id]-[title].md"
outputs:
  - TODO.md
  - .todo/*.md
---
```

## MCP Server

todo.mdx exposes an MCP server for AI assistants:

```bash
# Local (stdio) - for Claude Desktop
npx todo.mdx --mcp

# Remote (HTTP) - for cloud MCP clients
# Available at https://todo.mdx.do/mcp
```

**Tools available:**
- `listIssues` — List issues with filters
- `createIssue` — Create new issue
- `updateIssue` — Update issue status/fields
- `search` — Search across all issues
- `roadmap` — Get current roadmap state

## Why MDX?

MDX lets you embed React components in Markdown. This means:

1. **Composable** — Build complex views from simple components
2. **Type-safe** — Full TypeScript support
3. **Extensible** — Add custom components for your workflow
4. **Familiar** — It's just Markdown with superpowers

The output is always plain Markdown — readable by humans, AI, and tools.

## License

MIT
