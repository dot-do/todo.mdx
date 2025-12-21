---
id: todo-4nh
title: "Fix token caching to respect JWT expiry"
state: open
priority: 2
type: bug
labels: [bug, worker]
---

# Fix token caching to respect JWT expiry

In src/auth/vault.ts:232-233, 5-minute cache doesn't respect actual JWT expiry (GitHub tokens expire in 1 hour). Parse JWT exp claim to set correct cache TTL.

### Timeline

- **Created:** 12/20/2025

