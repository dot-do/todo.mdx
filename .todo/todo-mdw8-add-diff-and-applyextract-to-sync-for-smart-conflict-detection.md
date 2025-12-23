---
id: todo-mdw8
title: "Add diff() and applyExtract() to sync for smart conflict detection"
state: open
priority: 1
type: task
labels: ["mdxld", "phase-1"]
createdAt: "2025-12-23T13:44:13.908Z"
updatedAt: "2025-12-23T13:44:13.908Z"
source: "beads"
---

# Add diff() and applyExtract() to sync for smart conflict detection

Replace manual issuesAreEqual() and detectDifferentFields() in src/sync.ts with diff() and applyExtract() from @mdxld/markdown. This provides field-level diffing and proper merge semantics for conflict resolution.

### Timeline

- **Created:** 12/23/2025
- **Updated:** 12/23/2025
