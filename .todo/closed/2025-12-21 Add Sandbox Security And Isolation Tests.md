---
id: todo-ar67
title: "Add sandbox security and isolation tests"
state: closed
priority: 1
type: task
labels: ["sandbox", "security", "testing"]
assignee: "claude"
createdAt: "2025-12-21T22:45:36.093Z"
updatedAt: "2025-12-21T22:52:47.063Z"
closedAt: "2025-12-21T22:52:47.063Z"
source: "beads"
blocks: ["todo-7i9m", "todo-bprh"]
---

# Add sandbox security and isolation tests

Missing critical security test coverage:
- Privilege escalation attempts
- Container escape attempts
- Resource limit enforcement (CPU, memory, disk)
- Network isolation verification
- Inter-session file access verification
- Sensitive file access (/etc/passwd, /proc, etc.)

These tests should verify the sandbox is secure before production use.

### Related Issues

**Blocks:**
- [todo-7i9m](./todo-7i9m.md)
- [todo-bprh](./todo-bprh.md)