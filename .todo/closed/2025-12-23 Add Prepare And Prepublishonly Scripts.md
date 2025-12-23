---
id: todo-nfj6
title: "Add prepare and prepublishOnly scripts"
state: closed
priority: 1
type: task
labels: ["publishing"]
createdAt: "2025-12-23T13:05:00.523Z"
updatedAt: "2025-12-23T13:08:32.425Z"
closedAt: "2025-12-23T13:08:32.425Z"
source: "beads"
---

# Add prepare and prepublishOnly scripts

Add `"prepare": "tsup"` for auto-build on install from git/npm. Add `"prepublishOnly": "pnpm test && pnpm typecheck"` to ensure quality before publish.