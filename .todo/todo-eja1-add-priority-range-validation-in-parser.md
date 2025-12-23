---
id: todo-eja1
title: "Add priority range validation in parser"
state: closed
priority: 1
type: bug
labels: ["validation"]
createdAt: "2025-12-23T12:43:51.763Z"
updatedAt: "2025-12-23T12:53:08.895Z"
closedAt: "2025-12-23T12:53:08.895Z"
source: "beads"
---

# Add priority range validation in parser

**Issue**: Priority normalization doesn't validate the range. Invalid numeric values could bypass validation.

**Location**: `src/parser.ts` lines 41-42, 100-104

**Fix**:
- After parsing numeric priority, validate it's 0-4
- If out of range, default to 2 (medium)
- Add warning log for invalid values

**Test Cases**:
- Should accept 0, 1, 2, 3, 4 as valid
- Should reject -1 and default to 2
- Should reject 5, 10, 100 and default to 2
- Should handle string "high", "low" gracefully

### Timeline

- **Created:** 12/23/2025
- **Updated:** 12/23/2025
- **Closed:** 12/23/2025
