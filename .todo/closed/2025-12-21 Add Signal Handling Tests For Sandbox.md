---
id: todo-376h
title: "Add signal handling tests for sandbox"
state: closed
priority: 2
type: task
labels: ["sandbox", "testing"]
createdAt: "2025-12-21T22:45:52.118Z"
updatedAt: "2025-12-21T22:54:58.492Z"
closedAt: "2025-12-21T22:54:58.492Z"
source: "beads"
---

# Add signal handling tests for sandbox

Missing tests for signal handling:
- SIGTERM graceful shutdown
- SIGINT (Ctrl+C) handling
- SIGKILL force termination
- SIGHUP for long-running processes
- Signal propagation to child processes

The protocol supports signals but they're not tested.