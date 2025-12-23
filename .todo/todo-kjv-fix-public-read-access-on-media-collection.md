---
id: todo-kjv
title: "Fix public read access on Media collection"
state: closed
priority: 0
type: bug
labels: ["apps", "critical", "security"]
createdAt: "2025-12-20T20:02:20.064Z"
updatedAt: "2025-12-20T23:07:13.557Z"
closedAt: "2025-12-20T23:07:13.557Z"
source: "beads"
---

# Fix public read access on Media collection

In apps/admin/src/collections/Media.ts:6, read: () => true allows unauthenticated access to all uploaded files. Potential data leak for private/sensitive content. Implement proper access control based on user authentication.

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
