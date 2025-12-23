---
id: todo-dga
title: "GitHub Actions: Deploy worker on main push"
state: closed
priority: 1
type: task
labels: ["ci-cd", "cloudflare", "deploy"]
createdAt: "2025-12-20T20:04:02.789Z"
updatedAt: "2025-12-21T19:55:35.811Z"
closedAt: "2025-12-21T19:55:35.811Z"
source: "beads"
dependsOn: ["todo-w5g"]
---

# GitHub Actions: Deploy worker on main push

Create .github/workflows/deploy.yml to deploy Cloudflare Worker on push to main. Include secrets management.

### Related Issues

**Depends on:**
- [todo-w5g](./todo-w5g.md)