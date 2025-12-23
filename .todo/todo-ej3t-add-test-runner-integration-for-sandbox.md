---
id: todo-ej3t
title: "Add test runner integration for sandbox"
state: closed
priority: 1
type: task
labels: ["sandbox", "sdlc", "testing"]
createdAt: "2025-12-22T00:24:31.125Z"
updatedAt: "2025-12-22T06:52:53.655Z"
closedAt: "2025-12-22T06:52:53.655Z"
source: "beads"
---

# Add test runner integration for sandbox

Enable sandbox to run tests and parse results for AI feedback.

## Current State
- Sandbox can run arbitrary commands
- No structured test result parsing
- AI can't understand which tests failed

## Required Changes
1. Add `runTests()` method to ClaudeSandbox
2. Execute `pnpm test --reporter=json` 
3. Parse vitest JSON output
4. Return structured result:
   - passed: number
   - failed: number
   - failedTests: Array<{name, error, file}>
5. Add to sandbox API for agent access

### Related Issues

**Depends on:**
- **todo-e93y**
- **todo-lk5q**

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/22/2025
- **Closed:** 12/22/2025
