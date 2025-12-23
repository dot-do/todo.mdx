---
id: todo-si1
title: "Add todo.mdx API client for Payload/Worker data source"
state: closed
priority: 2
type: feature
labels: ["api", "todo.mdx"]
createdAt: "2025-12-20T20:09:20.058Z"
updatedAt: "2025-12-20T23:10:25.955Z"
closedAt: "2025-12-20T23:10:25.955Z"
source: "beads"
---

# Add todo.mdx API client for Payload/Worker data source

Connect todo.mdx compiler to the Payload/Worker API as a data source.

Currently only beads and local files are supported. Need:
- API client to fetch issues from todo.mdx.do API
- Authentication handling
- Map API response to Issue type
- Support filtering/pagination
- Real-time updates via WebSocket (optional)

This enables using the cloud backend as source of truth.

Location: packages/todo.mdx/src/api-client.ts (new file)

### Related Issues

**Depends on:**
- **todo-kxl**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
