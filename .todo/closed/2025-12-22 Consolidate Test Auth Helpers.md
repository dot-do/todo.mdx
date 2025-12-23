---
id: todo-ofvo
title: "Consolidate test auth helpers"
state: closed
priority: 2
type: chore
labels: ["dedup", "refactor", "tests"]
createdAt: "2025-12-22T08:05:47.931Z"
updatedAt: "2025-12-22T08:13:27.846Z"
closedAt: "2025-12-22T08:13:27.846Z"
source: "beads"
---

# Consolidate test auth helpers

getAuthToken() defined 4 times:
- tests/helpers/stdio.ts (lines 12-14)
- tests/helpers/worker.ts (lines 10-12)
- tests/e2e/mcp-server.test.ts (lines 17-19)
- tests/e2e/session-do.test.ts (lines 232-234)

Also generateGitHubSignature duplicated.

Create tests/helpers/auth.ts and consolidate.