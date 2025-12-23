---
id: todo-rpf
title: "E2E: Playwright tests for Web IDE (terminal, file tree, editor)"
state: closed
priority: 1
type: task
labels: ["e2e", "ide", "playwright", "testing"]
createdAt: "2025-12-20T20:13:47.170Z"
updatedAt: "2025-12-20T20:26:29.105Z"
closedAt: "2025-12-20T20:26:29.105Z"
source: "beads"
---

# E2E: Playwright tests for Web IDE (terminal, file tree, editor)

Add Playwright E2E tests for the Web IDE interface.

## Test Scenarios

### IDE Layout Tests
1. Page loads with correct layout (file tree, editor, terminal panels)
2. Panels are resizable
3. Sidebar can be toggled with Cmd+B
4. Terminal can be toggled with Cmd+`

### File Tree Tests
1. Displays repository file structure
2. Click on folder expands/collapses
3. Click on file opens in editor
4. Multiple files can be opened as tabs
5. Context menu appears on right-click

### Editor Tests
1. File content loads in Monaco editor
2. Syntax highlighting works based on file type
3. Cmd+S saves file (dirty indicator clears)
4. Unsaved changes show dirty indicator
5. Tab shows filename and close button
6. Cmd+W closes current tab

### Terminal Tests
1. Terminal connects via WebSocket
2. Terminal receives output from Claude
3. Terminal can be resized
4. ANSI colors render correctly

### Integration Tests
1. Create new session → redirects to IDE
2. Claude Code execution updates terminal
3. Files created by Claude appear in file tree
4. File changes refresh editor content

## Setup
- Add playwright config to apps/todo.mdx.do
- Use @playwright/test
- Mock WebSocket connections for unit tests
- Use real sandbox for integration tests

### Related Issues

**Depends on:**
- **todo-01p**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
