---
id: todo-wee0
title: "Fix webhook-signature.test.ts for production"
state: closed
priority: 2
type: task
labels: []
createdAt: "2025-12-21T04:47:58.535Z"
updatedAt: "2025-12-21T05:34:40.210Z"
closedAt: "2025-12-21T05:34:40.210Z"
source: "beads"
dependsOn: ["todo-8dmr", "todo-4qtf"]
---

# Fix webhook-signature.test.ts for production

Update webhook signature tests to work against production worker.

## Current failures (6 tests)
All tests fail with `fetch failed` to localhost:8787

## Key issue
Tests use `GITHUB_WEBHOOK_SECRET` defaulting to 'test-secret' which won't match production.

## Options
1. Use actual production webhook secret in CI (security concern)
2. Create test-mode endpoint that logs but doesn't verify signatures
3. Add separate test webhook secret that production worker also accepts

## Tests to fix
- Valid signature acceptance
- Missing signature rejection (401)
- Invalid signature rejection (401)
- Wrong secret rejection (401)
- Malformed signature rejection
- Modified payload detection

### Related Issues

**Depends on:**
- [todo-8dmr](./todo-8dmr.md)
- [todo-4qtf](./todo-4qtf.md)