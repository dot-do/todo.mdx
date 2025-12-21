# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is todo.mdx?

MDX components that render live data to markdown — realtime context for humans AND AI.

The core insight: README, TODO, ROADMAP, and AI instructions (CLAUDE.md, .cursorrules) are all views of the same data. Define once in MDX, render everywhere:

```
TODO.mdx    →  TODO.md + .todo/*.md files
ROADMAP.mdx →  ROADMAP.md + .roadmap/*.md files
AGENTS.mdx  →  CLAUDE.md + .cursorrules + .github/copilot-instructions.md
```

## Commands

```bash
# Monorepo (Turborepo + pnpm workspaces)
pnpm dev                    # Start all apps/packages in dev mode
pnpm build                  # Build all packages
pnpm typecheck              # Type check all packages
pnpm test                   # Run tests across all packages
pnpm test:e2e               # Run E2E tests only (tests/ package)

# Single package tests
pnpm --filter @todo.mdx/core test           # Run todo.mdx package tests
pnpm --filter @todo.mdx/tests test          # Run E2E tests

# Worker development
cd worker && pnpm dev       # Start worker locally (wrangler dev)
cd worker && pnpm deploy    # Deploy worker to Cloudflare

# Payload admin
cd apps/admin && pnpm dev   # Start Payload CMS admin

# Issue tracking (beads)
bd ready                    # Show issues ready to work (no blockers)
bd list --status=open       # All open issues
bd show <id>                # Issue details with dependencies
bd create --title="..."     # Create issue
bd close <id>               # Close issue
bd sync                     # Sync with git remote
```

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        todo.mdx.do                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Payload CMS │  │  Dashboard  │  │   Cloudflare Worker │ │
│  │  (apps/     │  │ (apps/todo. │  │     (worker/)       │ │
│  │   admin/)   │  │  mdx.do/)   │  │  (API/MCP/Webhooks) │ │
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
    │  beads  │      │  GitHub  │     │  Linear   │
    │ (local) │      │  Issues  │     │           │
    └─────────┘      └──────────┘     └───────────┘
```

### Key Architecture Patterns

1. **Workers RPC**: The Cloudflare Worker accesses Payload CMS via service binding (`env.PAYLOAD.find()`, `env.PAYLOAD.create()`, etc.) - see `worker/wrangler.jsonc` for the binding configuration

2. **Durable Objects**: Per-repo (`RepoDO`) and per-project (`ProjectDO`) coordination for sync operations - see `worker/src/do/`

3. **OAuth 2.1 + PKCE**: MCP server implements full OAuth 2.1 flow with WorkOS AuthKit - see `worker/src/mcp/index.ts`

4. **GitHub App Webhooks**: Installation, issues, milestones, push, and projects_v2 events - handled in `worker/src/index.ts`

### Data Flow

```
beads (.beads/) ←→ todo.mdx API ←→ GitHub Issues
       ↓                ↓
   TODO.mdx         Payload CMS
       ↓                ↓
   TODO.md          Dashboard
```

## Project Structure

```
todo.mdx/
├── apps/
│   ├── admin/             # Payload CMS backend (collections, config)
│   └── todo.mdx.do/       # Next.js docs site (Fumadocs + OpenNext)
├── packages/
│   ├── todo.mdx/          # Core: TODO.mdx → TODO.md + .todo/*.md
│   ├── roadmap.mdx/       # ROADMAP.mdx → ROADMAP.md
│   ├── cli.mdx/           # MDX-based CLI framework (planned)
│   └── dashboard/         # Shared dashboard components
├── worker/                # Cloudflare Worker
│   └── src/
│       ├── mcp/           # MCP server with OAuth 2.1
│       ├── do/            # Durable Objects (RepoDO, ProjectDO)
│       ├── auth/          # WorkOS AuthKit integration
│       └── api/           # REST API routes
├── tests/                 # E2E tests (vitest)
└── .beads/                # Local issue tracking database
```

## Key Files

- `packages/todo.mdx/src/compiler.ts` - MDX to markdown compilation
- `packages/todo.mdx/src/parser.ts` - Parse .todo/*.md files
- `worker/src/mcp/index.ts` - MCP server with OAuth 2.1 and tool implementations
- `worker/src/do/repo.ts` - RepoDO for per-repo sync coordination
- `worker/src/index.ts` - Main worker entry, webhook handlers
- `apps/admin/src/payload.config.ts` - Payload CMS configuration
- `apps/admin/src/collections/*.ts` - Payload collections (Users, Repos, Issues, etc.)

## Payload Collections

The admin app (`apps/admin/`) defines these collections:
- `Users` - WorkOS-authenticated users
- `Installations` - GitHub App installations
- `Repos` - Tracked repositories
- `Issues` - Synced issues
- `Milestones` - Synced milestones
- `LinearIntegrations` - Linear workspace connections

## Testing

- Unit tests use **vitest** in individual packages
- E2E tests in `tests/` package test worker, GitHub sync, Linear integration
- Run single test file: `pnpm --filter @todo.mdx/tests test -- tests/e2e/github-sync.test.ts`

## Environment Variables

Worker secrets (set via `wrangler secret`):
- `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET` - GitHub App
- `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_CLIENT_SECRET` - WorkOS AuthKit
- `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET`, `LINEAR_WEBHOOK_SECRET` - Linear
- `ANTHROPIC_API_KEY` - AI features

## Development Guidelines

- Use TypeScript strict mode
- Prefer functional programming patterns
- Write tests for new features using vitest
- Use conventional commits for commit messages
- Track issues with `bd` (beads) - check `bd ready` for unblocked tasks
