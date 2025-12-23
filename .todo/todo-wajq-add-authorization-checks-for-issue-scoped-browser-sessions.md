---
id: todo-wajq
title: "Add authorization checks for issue-scoped browser sessions"
state: closed
priority: 0
type: bug
labels: ["browser", "security"]
createdAt: "2025-12-22T00:15:25.330Z"
updatedAt: "2025-12-22T08:50:38.685Z"
closedAt: "2025-12-22T08:50:38.685Z"
source: "beads"
---

# Add authorization checks for issue-scoped browser sessions

Issue-scoped routes (/api/browser/:org/:repo/:issue/*) don't verify the user has access to the repository. Any authenticated user can create/access sessions for any repo.

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/22/2025
- **Closed:** 12/22/2025
