---
id: todo-osnn
title: "PRDO fix loop: changes requested → author fixes → re-review"
state: closed
priority: 0
type: task
labels: []
createdAt: "2025-12-21T18:42:31.156Z"
updatedAt: "2025-12-21T19:49:53.514Z"
closedAt: "2025-12-21T19:49:53.514Z"
source: "beads"
---

# PRDO fix loop: changes requested → author fixes → re-review

When reviewer requests changes:

1. PRDO transitions to 'fixing' state
2. Dispatch Claude session as original author
3. Claude addresses feedback, pushes fixes
4. GitHub synchronize webhook triggers re-review
5. Loop until approved or max retries

### Related Issues

**Depends on:**
- **todo-o9pp**
- **todo-tpef**

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
