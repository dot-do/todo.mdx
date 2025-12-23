---
id: todo-5bz4
title: "Fix IssueDO global state pollution causing race conditions"
state: closed
priority: 0
type: bug
labels: ["critical", "durable-objects", "race-condition"]
createdAt: "2025-12-22T00:23:25.307Z"
updatedAt: "2025-12-22T08:51:14.345Z"
closedAt: "2025-12-22T08:51:14.345Z"
source: "beads"
---

# Fix IssueDO global state pollution causing race conditions

IssueDO uses globalThis flags to communicate between XState actions and the DO. This is unsafe in concurrent environments where multiple DOs may run on the same isolate. The flags could be incorrectly shared between different DO instances.

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/22/2025
- **Closed:** 12/22/2025
