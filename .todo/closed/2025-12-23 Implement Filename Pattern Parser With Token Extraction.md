---
id: todo-5xpt
title: "Implement filename pattern parser with token extraction"
state: closed
priority: 1
type: task
labels: ["patterns", "phase-2"]
assignee: "claude"
createdAt: "2025-12-23T13:44:46.574Z"
updatedAt: "2025-12-23T14:06:01.990Z"
closedAt: "2025-12-23T14:06:01.990Z"
source: "beads"
blocks: ["todo-8txa", "todo-cnqo"]
---

# Implement filename pattern parser with token extraction

Create src/patterns.ts with pattern parsing logic. Parse patterns like "[id]-[title].md" into tokens. Detect delimiter context (dash=slugify, space=preserve). Support tokens: [id], [title], [Title], [yyyy-mm-dd], [type], [priority], [assignee]. Export parsePattern() and PatternToken type.

### Related Issues

**Blocks:**
- [todo-8txa](./todo-8txa.md)
- [todo-cnqo](./todo-cnqo.md)