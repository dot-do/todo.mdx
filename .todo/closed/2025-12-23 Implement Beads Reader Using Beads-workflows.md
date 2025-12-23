---
id: todo-j4h0
title: "Implement beads reader using beads-workflows"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-23T10:10:19.254Z"
updatedAt: "2025-12-23T10:23:38.646Z"
closedAt: "2025-12-23T10:23:38.646Z"
source: "beads"
dependsOn: ["todo-bf0d"]
blocks: ["todo-oc5o", "todo-v5px"]
---

# Implement beads reader using beads-workflows

Create src/beads.ts:
- Use beads-workflows.readIssuesFromJsonl() to load issues
- Use beads-workflows.findBeadsDir() to locate .beads/
- Map beads Issue type to internal Issue type

This replaces the current beads reading logic with the npm package.

### Related Issues

**Depends on:**
- [todo-bf0d](./todo-bf0d.md)

**Blocks:**
- [todo-oc5o](./todo-oc5o.md)
- [todo-v5px](./todo-v5px.md)