---
id: todo-zvzf
title: "Refactor agents.mdx to use beads-workflows SDK instead of CLI shelling"
state: closed
priority: 1
type: task
labels: ["beads-workflows", "refactor"]
createdAt: "2025-12-22T08:40:40.363Z"
updatedAt: "2025-12-22T08:57:46.614Z"
closedAt: "2025-12-22T08:57:46.614Z"
source: "beads"
---

# Refactor agents.mdx to use beads-workflows SDK instead of CLI shelling

Replace CLI-based beads operations in `packages/agents.mdx/src/local.ts` with SDK calls from beads-workflows.

Current state (local.ts:224-296):
- beadsIssuesList, beadsIssuesReady, beadsIssuesBlocked shell out to `bd` CLI
- beadsIssuesCreate, beadsIssuesUpdate, beadsIssuesClose shell out to `bd` CLI
- beadsEpicsList, beadsEpicsProgress shell out to `bd` CLI

Target state:
- Use `createIssuesApi()` from beads-workflows
- Use `createEpicsApi()` from beads-workflows
- Remove CLI subprocess overhead

### Related Issues

**Depends on:**
- **todo-5y61**

### Timeline

- **Created:** 12/22/2025
- **Updated:** 12/22/2025
- **Closed:** 12/22/2025
