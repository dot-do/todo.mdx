---
id: todo-9zm
title: "Enable strictNullChecks in TypeScript"
state: open
priority: 1
type: task
labels: [apps, typescript]
---

# Enable strictNullChecks in TypeScript

strictNullChecks disabled in apps/admin/tsconfig.json:12. Removes compile-time null safety. Particularly dangerous in access control logic using user?.roles?.includes('admin') patterns.

### Timeline

- **Created:** 12/20/2025

