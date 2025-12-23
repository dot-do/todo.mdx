---
id: todo-2uw
title: "Replace excessive `any` types with proper TypeScript interfaces"
state: closed
priority: 1
type: task
labels: ["code-quality", "typescript"]
createdAt: "2025-12-20T20:02:54.404Z"
updatedAt: "2025-12-21T13:30:35.368Z"
closedAt: "2025-12-21T13:30:35.368Z"
source: "beads"
---

# Replace excessive `any` types with proper TypeScript interfaces

58+ uses of `any` in worker code, 66 instances across packages. Type safety completely bypassed. Most handlers and DO classes use `any` for webhook payloads, API responses. Create proper TypeScript interfaces for all data structures.

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
