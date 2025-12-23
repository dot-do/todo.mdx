---
id: todo-huns
title: "E2E: Session deletion returning 401 instead of 404"
state: closed
priority: 1
type: bug
labels: []
createdAt: "2025-12-21T14:09:46.938Z"
updatedAt: "2025-12-21T14:21:26.264Z"
closedAt: "2025-12-21T14:21:26.264Z"
source: "beads"
---

# E2E: Session deletion returning 401 instead of 404

test: session-do.test.ts - concurrent session stress test

Session deletion and status check endpoints return 401 instead of expected 404.

Expected: Deleted session status should return 404 (not found)
Actual: Returns 401 (unauthorized)

This suggests authentication is required for session operations that should be public, or the session ID extraction is failing.

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
