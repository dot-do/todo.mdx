---
id: todo-ht44
title: "Add long-running process and background job tests"
state: closed
priority: 3
type: task
labels: ["sandbox", "testing"]
createdAt: "2025-12-21T22:46:02.798Z"
updatedAt: "2025-12-23T10:08:49.121Z"
closedAt: "2025-12-23T10:08:49.121Z"
source: "beads"
---

# Add long-running process and background job tests

No testing for:
- Background process management (nohup, &)
- Process that outlives WebSocket connection
- Reconnection to running processes
- Session timeout with active processes
- Orphan process cleanup