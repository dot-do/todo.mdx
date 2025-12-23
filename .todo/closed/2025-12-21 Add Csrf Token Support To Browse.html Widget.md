---
id: todo-c57n
title: "Add CSRF token support to browse.html widget"
state: closed
priority: 1
type: bug
labels: ["browser", "security"]
createdAt: "2025-12-22T00:15:46.929Z"
updatedAt: "2025-12-22T00:25:48.327Z"
closedAt: "2025-12-22T00:25:48.327Z"
source: "beads"
---

# Add CSRF token support to browse.html widget

Widget makes authenticated API calls but doesn't include CSRF token in requests. All calls will fail with CSRF protection enabled.