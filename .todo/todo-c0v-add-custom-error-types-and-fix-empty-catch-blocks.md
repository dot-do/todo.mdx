---
id: todo-c0v
title: "Add custom error types and fix empty catch blocks"
state: closed
priority: 1
type: task
labels: ["code-quality", "packages"]
createdAt: "2025-12-20T20:02:54.939Z"
updatedAt: "2025-12-21T21:50:54.151Z"
closedAt: "2025-12-21T21:50:54.151Z"
source: "beads"
---

# Add custom error types and fix empty catch blocks

Empty catch blocks and generic errors throughout packages: catch { return [] } silently fails, throw new Error('Failed...') has no error hierarchy. Create structured error types (TodoMdxError, CompilationError, etc.) and add proper error logging.

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
