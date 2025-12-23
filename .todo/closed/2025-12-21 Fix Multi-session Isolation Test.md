---
id: todo-bprh
title: "Fix multi-session isolation test"
state: closed
priority: 2
type: task
labels: ["sandbox", "testing"]
createdAt: "2025-12-21T22:45:41.434Z"
updatedAt: "2025-12-21T22:55:03.767Z"
closedAt: "2025-12-21T22:55:03.767Z"
source: "beads"
dependsOn: ["todo-ar67"]
---

# Fix multi-session isolation test

The test "sessions are isolated (requires multiple containers)" is currently SKIPPED due to rate limit concerns.

Need to:
1. Implement proper rate limit handling in tests
2. Or run in a test environment with higher limits
3. Verify file system isolation between sessions
4. Verify process isolation between sessions

### Related Issues

**Depends on:**
- [todo-ar67](./todo-ar67.md)