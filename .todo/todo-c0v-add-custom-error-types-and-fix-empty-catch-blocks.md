---
id: todo-c0v
title: "Add custom error types and fix empty catch blocks"
state: open
priority: 1
type: task
labels: [code-quality, packages]
---

# Add custom error types and fix empty catch blocks

Empty catch blocks and generic errors throughout packages: catch { return [] } silently fails, throw new Error('Failed...') has no error hierarchy. Create structured error types (TodoMdxError, CompilationError, etc.) and add proper error logging.

### Timeline

- **Created:** 12/20/2025

