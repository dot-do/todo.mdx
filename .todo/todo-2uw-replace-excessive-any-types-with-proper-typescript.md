---
id: todo-2uw
title: "Replace excessive `any` types with proper TypeScript interfaces"
state: open
priority: 1
type: task
labels: [code-quality, typescript]
---

# Replace excessive `any` types with proper TypeScript interfaces

58+ uses of `any` in worker code, 66 instances across packages. Type safety completely bypassed. Most handlers and DO classes use `any` for webhook payloads, API responses. Create proper TypeScript interfaces for all data structures.

### Timeline

- **Created:** 12/20/2025

