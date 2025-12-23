---
id: todo-48dg
title: "E2E: Webhook signature verification returning 401"
state: closed
priority: 1
type: bug
labels: []
createdAt: "2025-12-21T14:09:41.049Z"
updatedAt: "2025-12-21T14:21:26.263Z"
closedAt: "2025-12-21T14:21:26.263Z"
source: "beads"
---

# E2E: Webhook signature verification returning 401

test: webhook-signature.test.ts

Webhook with valid signature returns 401 instead of accepting the request.

Expected: Valid signature should not return 401
Actual: Returns 401

This indicates the webhook signature validation middleware may have a bug, or the test environment is missing required credentials.