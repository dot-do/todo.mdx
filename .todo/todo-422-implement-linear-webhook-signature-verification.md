---
id: todo-422
title: "Implement Linear webhook signature verification"
state: open
priority: 0
type: bug
labels: [critical, security, worker]
---

# Implement Linear webhook signature verification

Missing webhook signature verification in src/api/linear.ts:328. Spoofed webhooks can corrupt data. Currently only has TODO comment.

### Timeline

- **Created:** 12/20/2025

