---
id: todo-774
title: "Implement rate limiting on API endpoints"
state: closed
priority: 1
type: feature
labels: ["security", "worker"]
createdAt: "2025-12-20T20:02:55.138Z"
updatedAt: "2025-12-21T20:51:29.709Z"
closedAt: "2025-12-21T20:51:29.709Z"
source: "beads"
---

# Implement rate limiting on API endpoints

No rate limiting configured on any API routes or Payload endpoints. API vulnerable to brute force attacks on auth and DoS. GraphQL endpoints especially at risk from expensive queries. Implement using Cloudflare Workers rate limiting with Durable Objects.

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
