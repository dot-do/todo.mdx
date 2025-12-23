---
id: todo-w5cb
title: "Remove redundant Timeline section from generated .todo/*.md files"
state: open
priority: 1
type: task
labels: []
createdAt: "2025-12-23T13:23:48.720Z"
updatedAt: "2025-12-23T13:23:48.720Z"
source: "beads"
---

# Remove redundant Timeline section from generated .todo/*.md files

The generator creates a Timeline section with Created/Updated/Closed dates, but these dates are already in the YAML frontmatter (createdAt, updatedAt, closedAt). Remove the redundant Timeline section from generateBody() in src/generator.ts.

### Timeline

- **Created:** 12/23/2025
- **Updated:** 12/23/2025
