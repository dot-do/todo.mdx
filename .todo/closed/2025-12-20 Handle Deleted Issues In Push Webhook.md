---
id: todo-t2xt
title: "Handle deleted issues in push webhook"
state: closed
priority: 1
type: task
labels: ["mvp", "phase-1", "sync"]
createdAt: "2025-12-21T00:37:22.877Z"
updatedAt: "2025-12-21T00:40:37.576Z"
closedAt: "2025-12-21T00:40:37.576Z"
source: "beads"
---

# Handle deleted issues in push webhook

Detect issues removed from `.beads/issues.jsonl` and close them on GitHub. In `onBeadsPush()`, compare imported issues with existing and close orphans.