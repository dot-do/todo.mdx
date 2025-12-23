---
id: todo-addd
title: "DevelopWorkflow creates PR with Claude implementation"
state: closed
priority: 0
type: task
labels: []
createdAt: "2025-12-21T18:41:26.799Z"
updatedAt: "2025-12-21T19:07:12.880Z"
closedAt: "2025-12-21T19:07:12.880Z"
source: "beads"
dependsOn: ["todo-d502", "todo-dexj"]
blocks: ["todo-1q18"]
---

# DevelopWorkflow creates PR with Claude implementation

Complete the DevelopWorkflow to:
1. Spawn Claude via callClaude() with issue context
2. Create branch from Claude's diff
3. Open PR via callGitHub()
4. Link PR to issue

The workflow should use step.do() for durability.

### Related Issues

**Depends on:**
- [todo-d502](./todo-d502.md)
- [todo-dexj](./todo-dexj.md)

**Blocks:**
- [todo-1q18](./todo-1q18.md)