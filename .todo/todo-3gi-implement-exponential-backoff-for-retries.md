---
id: todo-3gi
title: "Implement exponential backoff for retries"
state: open
priority: 2
type: task
labels: [performance, worker]
---

# Implement exponential backoff for retries

In src/do/repo.ts:129, fixed 1-second retry with no exponential backoff. Implement backoff based on error count.

### Timeline

- **Created:** 12/20/2025

