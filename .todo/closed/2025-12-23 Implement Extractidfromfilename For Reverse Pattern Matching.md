---
id: todo-8txa
title: "Implement extractIdFromFilename() for reverse pattern matching"
state: closed
priority: 1
type: task
labels: ["patterns", "phase-2"]
createdAt: "2025-12-23T13:44:57.250Z"
updatedAt: "2025-12-23T14:06:12.668Z"
closedAt: "2025-12-23T14:06:12.668Z"
source: "beads"
dependsOn: ["todo-5xpt"]
---

# Implement extractIdFromFilename() for reverse pattern matching

Add extractIdFromFilename(filename, pattern) to src/patterns.ts. Build regex from pattern to extract [id] value from filename. Handle subdirectory patterns. Return null if pattern doesn't match. Used for matching files to issues during sync.

### Related Issues

**Depends on:**
- [todo-5xpt](./todo-5xpt.md)