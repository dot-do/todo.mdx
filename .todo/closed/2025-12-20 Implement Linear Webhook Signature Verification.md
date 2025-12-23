---
id: todo-422
title: "Implement Linear webhook signature verification"
state: closed
priority: 0
type: bug
labels: ["critical", "security", "worker"]
createdAt: "2025-12-20T20:02:19.742Z"
updatedAt: "2025-12-20T23:07:13.094Z"
closedAt: "2025-12-20T23:07:13.094Z"
source: "beads"
---

# Implement Linear webhook signature verification

Missing webhook signature verification in src/api/linear.ts:328. Spoofed webhooks can corrupt data. Currently only has TODO comment.