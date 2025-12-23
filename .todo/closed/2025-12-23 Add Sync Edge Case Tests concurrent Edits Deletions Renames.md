---
id: todo-3rzy
title: "Add sync edge case tests (concurrent edits, deletions, renames)"
state: closed
priority: 2
type: task
labels: ["phase-4", "testing"]
createdAt: "2025-12-23T13:46:09.337Z"
updatedAt: "2025-12-23T14:22:53.698Z"
closedAt: "2025-12-23T14:22:53.698Z"
source: "beads"
---

# Add sync edge case tests (concurrent edits, deletions, renames)

Create tests/sync-edge-cases.test.ts with: concurrent edit conflict detection, deleted in beads vs file exists, deleted file vs beads exists, renamed/moved files matched by ID, circular dependency detection, orphan dependency warnings.