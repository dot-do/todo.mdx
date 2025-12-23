---
id: todo-wv5r
title: "Agent persona storage and API"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-22T11:51:59.453Z"
updatedAt: "2025-12-22T14:06:04.357Z"
closedAt: "2025-12-22T14:06:04.357Z"
source: "beads"
dependsOn: ["todo-qsgs", "todo-jqdh"]
blocks: ["todo-4xkm"]
---

# Agent persona storage and API

Implement cloud storage for agent personas:
- Store agent definitions in Payload CMS or D1
- REST API: GET /agents, GET /agents/:name
- Merge pre-built + custom (from agents.mdx sync)
- Serve to workflow runtime

### Related Issues

**Depends on:**
- [todo-qsgs](./todo-qsgs.md)
- [todo-jqdh](./todo-jqdh.md)

**Blocks:**
- [todo-4xkm](./todo-4xkm.md)