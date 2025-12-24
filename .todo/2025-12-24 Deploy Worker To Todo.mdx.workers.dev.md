---
id: todo-wq9p
title: "Deploy worker to todo.mdx.workers.dev"
state: open
priority: 2
type: task
labels: ["deployment", "worker"]
createdAt: "2025-12-24T11:06:04.283Z"
updatedAt: "2025-12-24T11:06:04.283Z"
source: "beads"
dependsOn: ["todo-dvxh"]
---

# Deploy worker to todo.mdx.workers.dev

README mentions hosted service at https://todo.mdx.workers.dev/webhook but the worker needs to be actually deployed. Requires:
1. GitHub App creation with appropriate permissions
2. Setting secrets (GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_WEBHOOK_SECRET)
3. Running wrangler deploy

### Related Issues

**Depends on:**
- [todo-dvxh](./todo-dvxh.md)