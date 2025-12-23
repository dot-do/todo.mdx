---
id: todo-y5yb
title: "Add authorization checks for issue-scoped browser sessions"
state: closed
priority: 1
type: bug
labels: []
createdAt: "2025-12-22T00:16:22.956Z"
updatedAt: "2025-12-22T00:25:32.282Z"
closedAt: "2025-12-22T00:25:32.282Z"
source: "beads"
---

# Add authorization checks for issue-scoped browser sessions

Issue-scoped routes (/api/browser/:org/:repo/:issue/*) don't verify the user has access to the repository. Any authenticated user can create/access sessions for any repo.

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
