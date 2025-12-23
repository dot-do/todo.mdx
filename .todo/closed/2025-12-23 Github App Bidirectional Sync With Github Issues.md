---
id: todo-v5yv
title: "GitHub App: Bidirectional Sync with GitHub Issues"
state: closed
priority: 1
type: epic
labels: ["github-app", "phase-1", "phase-2"]
createdAt: "2025-12-23T13:35:29.258Z"
updatedAt: "2025-12-23T14:16:10.106Z"
closedAt: "2025-12-23T14:16:10.106Z"
source: "beads"
blocks: ["todo-44c0", "todo-4ygu", "todo-76x3", "todo-8wqd", "todo-aifu", "todo-fx0p", "todo-ghw6", "todo-o900", "todo-qu6s", "todo-sz2t"]
---

# GitHub App: Bidirectional Sync with GitHub Issues

Create a Cloudflare Workers-based GitHub App that provides bidirectional sync between beads issue tracker and GitHub Issues.

## Architecture
```
GitHub Issues ←→ [CF Worker + Hono + db.td] ←→ beads (.beads/issues.jsonl)
```

## Tech Stack
- Cloudflare Workers + Hono
- db.td for database layer (installations, sync state, mappings)
- beads-workflows for issue operations
- Octokit for GitHub API

## Phases
1. **Phase 1**: GitHub → Beads (webhook-driven import)
2. **Phase 2**: Beads → GitHub (push changes back)
3. **Phase 3**: Full bidirectional with conflict resolution

## Convention System
GitHub lacks native support for dependencies, epics, and in-progress status. We use customizable conventions defined in TODO.mdx and [Issue].mdx templates:

- **Dependencies**: Markdown patterns in issue body (e.g., `Depends on: #123, #456`)
- **Epics**: Labels like `epic:feature-name` or parent refs in body
- **Priority**: Labels `P0`, `P1`, `P2`, `P3`, `P4`
- **Type**: Labels `bug`, `feature`, `task`, `chore`
- **In-Progress**: Label `status:in-progress`

All conventions are configurable per-project.

### Related Issues

**Blocks:**
- [todo-44c0](./todo-44c0.md)
- [todo-4ygu](./todo-4ygu.md)
- [todo-76x3](./todo-76x3.md)
- [todo-8wqd](./todo-8wqd.md)
- [todo-aifu](./todo-aifu.md)
- [todo-fx0p](./todo-fx0p.md)
- [todo-ghw6](./todo-ghw6.md)
- [todo-o900](./todo-o900.md)
- [todo-qu6s](./todo-qu6s.md)
- [todo-sz2t](./todo-sz2t.md)