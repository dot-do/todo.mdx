---
id: todo-4nh
title: "Fix token caching to respect JWT expiry"
state: closed
priority: 2
type: bug
labels: ["bug", "worker"]
createdAt: "2025-12-20T20:03:28.367Z"
updatedAt: "2025-12-23T10:08:49.117Z"
closedAt: "2025-12-23T10:08:49.117Z"
source: "beads"
---

# Fix token caching to respect JWT expiry

In src/auth/vault.ts:232-233, 5-minute cache doesn't respect actual JWT expiry (GitHub tokens expire in 1 hour). Parse JWT exp claim to set correct cache TTL.

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/23/2025
- **Closed:** 12/23/2025
