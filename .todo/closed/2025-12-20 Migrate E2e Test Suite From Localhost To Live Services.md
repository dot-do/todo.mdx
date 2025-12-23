---
id: todo-8dmr
title: "Migrate E2E test suite from localhost to live services"
state: closed
priority: 1
type: epic
labels: []
createdAt: "2025-12-21T04:47:06.373Z"
updatedAt: "2025-12-23T10:08:49.101Z"
closedAt: "2025-12-23T10:08:49.101Z"
source: "beads"
blocks: ["todo-04mz", "todo-4qtf", "todo-9i3u", "todo-amd6", "todo-imrr", "todo-wee0", "todo-wgzx", "todo-wp86", "todo-x7l1"]
---

# Migrate E2E test suite from localhost to live services

E2E tests currently hit localhost:8787 which requires running wrangler dev locally. True E2E testing should hit deployed production endpoints and trigger real events in test repositories.

## Current State
- 28 tests failing due to `ECONNREFUSED localhost:8787`
- Tests expect local wrangler dev server
- Some tests already use production URLs (site.test.ts, admin-site.test.ts)

## Target State
- All tests hit `https://todo.mdx.do` or `https://api.todo.mdx.do`
- Tests create real data in test repo `dot-do/test.mdx`
- GitHub/Linear webhooks trigger actual sync flows
- CI can run full E2E suite against production

### Related Issues

**Blocks:**
- [todo-04mz](./todo-04mz.md)
- [todo-4qtf](./todo-4qtf.md)
- [todo-9i3u](./todo-9i3u.md)
- [todo-amd6](./todo-amd6.md)
- [todo-imrr](./todo-imrr.md)
- [todo-wee0](./todo-wee0.md)
- [todo-wgzx](./todo-wgzx.md)
- [todo-wp86](./todo-wp86.md)
- [todo-x7l1](./todo-x7l1.md)