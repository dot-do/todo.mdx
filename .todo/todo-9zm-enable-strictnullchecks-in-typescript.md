---
id: todo-9zm
title: "Enable strictNullChecks in TypeScript"
state: closed
priority: 1
type: task
labels: ["apps", "typescript"]
createdAt: "2025-12-20T20:02:54.743Z"
updatedAt: "2025-12-21T20:48:06.678Z"
closedAt: "2025-12-21T20:48:06.678Z"
source: "beads"
---

# Enable strictNullChecks in TypeScript

strictNullChecks disabled in apps/admin/tsconfig.json:12. Removes compile-time null safety. Particularly dangerous in access control logic using user?.roles?.includes('admin') patterns.

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
