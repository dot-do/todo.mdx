---
id: todo-8w8a
title: "PR webhook routing to PRDO"
state: closed
priority: 0
type: task
labels: []
createdAt: "2025-12-21T18:42:36.539Z"
updatedAt: "2025-12-21T19:49:53.514Z"
closedAt: "2025-12-21T19:49:53.514Z"
source: "beads"
dependsOn: ["todo-o9pp", "todo-tnwk"]
---

# PR webhook routing to PRDO

Route GitHub PR webhooks to PRDO:

- pull_request.opened → PR_OPENED event
- pull_request.synchronize → FIX_COMPLETE event
- pull_request.closed → CLOSE event
- pull_request_review.submitted → REVIEW_COMPLETE event

Naming: PRDO ID = `{owner}/{repo}#{pr_number}`

### Related Issues

**Depends on:**
- [todo-o9pp](./todo-o9pp.md)
- [todo-tnwk](./todo-tnwk.md)