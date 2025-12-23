---
id: todo-8txa
title: "Implement extractIdFromFilename() for reverse pattern matching"
state: open
priority: 1
type: task
labels: ["patterns", "phase-2"]
createdAt: "2025-12-23T13:44:57.250Z"
updatedAt: "2025-12-23T13:44:57.250Z"
source: "beads"
---

# Implement extractIdFromFilename() for reverse pattern matching

Add extractIdFromFilename(filename, pattern) to src/patterns.ts. Build regex from pattern to extract [id] value from filename. Handle subdirectory patterns. Return null if pattern doesn't match. Used for matching files to issues during sync.

### Related Issues

**Depends on:**
- **todo-5xpt**

### Timeline

- **Created:** 12/23/2025
- **Updated:** 12/23/2025
