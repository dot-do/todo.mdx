---
id: todo-774
title: "Implement rate limiting on API endpoints"
state: open
priority: 1
type: feature
labels: [security, worker]
---

# Implement rate limiting on API endpoints

No rate limiting configured on any API routes or Payload endpoints. API vulnerable to brute force attacks on auth and DoS. GraphQL endpoints especially at risk from expensive queries. Implement using Cloudflare Workers rate limiting with Durable Objects.

### Timeline

- **Created:** 12/20/2025

