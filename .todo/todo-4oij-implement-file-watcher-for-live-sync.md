---
id: todo-4oij
title: "Implement file watcher for live sync"
state: closed
priority: 2
type: task
labels: []
createdAt: "2025-12-23T10:10:45.919Z"
updatedAt: "2025-12-23T10:41:58.073Z"
closedAt: "2025-12-23T10:41:58.073Z"
source: "beads"
---

# Implement file watcher for live sync

Create src/watcher.ts:
- Watch .todo/*.md for changes (chokidar)
- Watch .beads/issues.jsonl for changes
- Debounce rapid changes
- Trigger sync on file changes

Optional: use beads-workflows.createWatcher() if available.

### Related Issues

**Depends on:**
- **todo-v5px**

### Timeline

- **Created:** 12/23/2025
- **Updated:** 12/23/2025
- **Closed:** 12/23/2025
