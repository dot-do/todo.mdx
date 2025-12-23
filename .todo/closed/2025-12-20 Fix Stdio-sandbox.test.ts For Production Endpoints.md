---
id: todo-9i3u
title: "Fix stdio-sandbox.test.ts for production endpoints"
state: closed
priority: 2
type: task
labels: []
createdAt: "2025-12-21T04:47:58.409Z"
updatedAt: "2025-12-21T05:34:40.169Z"
closedAt: "2025-12-21T05:34:40.169Z"
source: "beads"
dependsOn: ["todo-8dmr", "todo-amd6", "todo-4qtf"]
---

# Fix stdio-sandbox.test.ts for production endpoints

Update stdio-sandbox tests to work with production sandbox endpoint.

## Current failures (22 tests)
All tests fail with `fetch failed` to localhost:8787

## Changes needed
1. Update base URL to production
2. Ensure auth token is passed correctly
3. Handle container cold-start delays (add retries)
4. Update expected response formats if changed

## Test categories
- Session management (create, status, delete)
- Command execution (echo, args, stderr, exit codes)
- Stdin handling
- Bash integration
- Git/Node/Bun availability
- Timeout handling
- Concurrent sessions

### Related Issues

**Depends on:**
- [todo-8dmr](./todo-8dmr.md)
- [todo-amd6](./todo-amd6.md)
- [todo-4qtf](./todo-4qtf.md)