---
id: todo-ndl7
title: "Reject empty issue IDs in parser"
state: closed
priority: 1
type: bug
labels: ["parser", "validation"]
createdAt: "2025-12-23T12:44:02.494Z"
updatedAt: "2025-12-23T12:53:14.223Z"
closedAt: "2025-12-23T12:53:14.223Z"
source: "beads"
---

# Reject empty issue IDs in parser

**Issue**: Parser accepts empty string as valid issue ID, which causes problems downstream.

**Location**: `src/parser.ts` lines 116-117

**Fix**:
- Check if ID is empty or whitespace-only
- Throw descriptive error if ID is missing
- Update error message to guide users

**Test Cases**:
- Should throw for empty id: ""
- Should throw for whitespace id: "   "
- Should throw for missing id field
- Should accept valid IDs like "todo-123"

### Timeline

- **Created:** 12/23/2025
- **Updated:** 12/23/2025
- **Closed:** 12/23/2025
