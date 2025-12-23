---
id: todo-swqn
title: "Add dependency management MCP tools"
state: closed
priority: 2
type: task
labels: ["mcp", "mvp", "phase-2"]
createdAt: "2025-12-21T00:37:23.261Z"
updatedAt: "2025-12-21T04:00:56.559Z"
closedAt: "2025-12-21T04:00:56.559Z"
source: "beads"
---

# Add dependency management MCP tools

In `worker/src/mcp/index.ts`, add `add_dependency` and `remove_dependency` tools. Accept: repo, issue_id, depends_on_id, dep_type.