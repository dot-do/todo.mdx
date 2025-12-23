---
id: todo-imrr
title: "Add test data cleanup for Linear integration tests"
state: closed
priority: 3
type: task
labels: []
createdAt: "2025-12-21T04:47:58.919Z"
updatedAt: "2025-12-23T10:08:49.122Z"
closedAt: "2025-12-23T10:08:49.122Z"
source: "beads"
---

# Add test data cleanup for Linear integration tests

Linear integration tests create real issues that need proper cleanup.

## Current behavior
- Tests create issues with `Date.now()` suffixes
- Some cleanup in afterEach but not comprehensive
- Failed tests may leave orphaned issues

## Improvements needed
1. Track all created issue IDs
2. Archive/delete in afterAll hook
3. Add global cleanup utility for manual runs
4. Consider using Linear labels for test issues (e.g., "e2e-test")

## Risk mitigation
- Use dedicated Linear project for tests
- Prefix all test issue titles with `[E2E]`
- Periodic cleanup job for orphaned test data

### Related Issues

**Depends on:**
- **todo-8dmr**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/23/2025
- **Closed:** 12/23/2025
