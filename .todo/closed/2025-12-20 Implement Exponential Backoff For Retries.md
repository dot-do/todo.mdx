---
id: todo-3gi
title: "Implement exponential backoff for retries"
state: closed
priority: 2
type: task
labels: ["performance", "worker"]
createdAt: "2025-12-20T20:03:28.273Z"
updatedAt: "2025-12-23T10:08:49.117Z"
closedAt: "2025-12-23T10:08:49.117Z"
source: "beads"
---

# Implement exponential backoff for retries

In src/do/repo.ts:129, fixed 1-second retry with no exponential backoff. Implement backoff based on error count.