---
id: todo-wjh6
title: "Sanitize issue ID to prevent path traversal in filenames"
state: closed
priority: 0
type: bug
labels: ["critical", "security"]
createdAt: "2025-12-23T12:43:46.331Z"
updatedAt: "2025-12-23T12:53:03.566Z"
closedAt: "2025-12-23T12:53:03.566Z"
source: "beads"
---

# Sanitize issue ID to prevent path traversal in filenames

**Security Issue**: `generateFilename` doesn't sanitize issue.id. IDs containing `../` could write files outside the intended directory.

**Location**: `src/generator.ts` lines 25-28

**Fix**:
- Sanitize ID to remove path traversal characters
- Only allow alphanumeric, dash, and underscore
- Throw error if ID is empty after sanitization

**Test Cases**:
- Should sanitize `task/../../../etc/passwd` to safe ID
- Should handle IDs with slashes like `task/subtask`
- Should preserve valid IDs like `todo-abc123`
- Should throw on empty ID after sanitization