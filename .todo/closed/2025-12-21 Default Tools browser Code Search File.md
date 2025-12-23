---
id: todo-jsfq
title: "Default tools (browser, code, search, file)"
state: closed
priority: 1
type: task
labels: ["foundation"]
createdAt: "2025-12-21T14:58:39.698Z"
updatedAt: "2025-12-21T15:16:18.047Z"
closedAt: "2025-12-21T15:16:18.047Z"
source: "beads"
dependsOn: ["todo-qd32", "todo-76xz"]
---

# Default tools (browser, code, search, file)

Implement default tools that require no authentication:

- `worker/src/tools/defaults/browser.ts` - browser.fetchPage, browser.screenshot
- `worker/src/tools/defaults/code.ts` - code.execute, code.installPackage
- `worker/src/tools/defaults/search.ts` - search.web, search.images
- `worker/src/tools/defaults/file.ts` - file.read, file.write, file.list
- `worker/src/tools/defaults/index.ts` - export all

These are always available to agents regardless of user connections.

### Related Issues

**Depends on:**
- [todo-qd32](./todo-qd32.md)
- [todo-76xz](./todo-76xz.md)