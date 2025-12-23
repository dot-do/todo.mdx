---
id: todo-dmba
title: "Fix IssueDO global state pollution causing race conditions"
state: closed
priority: 1
type: bug
labels: []
createdAt: "2025-12-22T00:24:44.390Z"
updatedAt: "2025-12-22T00:34:42.154Z"
closedAt: "2025-12-22T00:34:42.154Z"
source: "beads"
---

# Fix IssueDO global state pollution causing race conditions

IssueDO uses globalThis flags to communicate between XState actions and the DO. This is unsafe in concurrent environments where multiple DOs may run on the same isolate.