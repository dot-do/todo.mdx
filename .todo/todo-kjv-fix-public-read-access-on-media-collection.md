---
id: todo-kjv
title: "Fix public read access on Media collection"
state: open
priority: 0
type: bug
labels: [apps, critical, security]
---

# Fix public read access on Media collection

In apps/admin/src/collections/Media.ts:6, read: () => true allows unauthenticated access to all uploaded files. Potential data leak for private/sensitive content. Implement proper access control based on user authentication.

### Timeline

- **Created:** 12/20/2025

