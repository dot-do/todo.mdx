---
id: todo-y57z
title: "Fix Cloudflare provider in-memory storage bug"
state: closed
priority: 2
type: bug
labels: ["browser", "bug"]
createdAt: "2025-12-22T00:15:36.146Z"
updatedAt: "2025-12-22T08:50:28.048Z"
closedAt: "2025-12-22T08:50:28.048Z"
source: "beads"
---

# Fix Cloudflare provider in-memory storage bug

CloudflareBrowserProvider uses Map<> for session storage which doesn't persist across worker instances. Sessions are lost immediately.

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/22/2025
- **Closed:** 12/22/2025
