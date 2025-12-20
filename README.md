# TODO.mdx

Bidirectional sync between MDX templates, markdown files, GitHub Issues/Milestones/Projects, and beads.

## Packages

### [todo.mdx](./packages/todo.mdx)

Sync `TODO.mdx` → `TODO.md` and `.todo/*.md` ↔ GitHub Issues ↔ beads

```bash
npx todo.mdx
```

### [roadmap.mdx](./packages/roadmap.mdx)

Sync `ROADMAP.mdx` → `ROADMAP.md` and `.roadmap/*.md` ↔ GitHub Milestones/Projects ↔ beads epics

```bash
npx roadmap.mdx
```

## GitHub App

The TODO.mdx GitHub App provides real-time sync:
- Changes to GitHub Issues → updates `.todo/*.md` files
- Edits to `.todo/*.md` files → updates GitHub Issues
- GitHub Milestones ↔ `.roadmap/*.md` files
- GitHub Projects for cross-repo roadmap coordination

### Worker

The worker uses Cloudflare Workers with:
- **D1** - GitHub App installations and DO registry
- **Durable Objects** - Per-repo and per-project sync state (SQLite)
- **Drizzle ORM** - Type-safe database access

## File Patterns

Configure naming in frontmatter:

```mdx
---
filePattern: "[id]-[title].mdx"
---
```

Available variables: `[id]`, `[title]`, `[type]`, `[priority]`, `[state]`

## License

MIT
