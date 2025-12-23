---
id: todo-cfh5
title: "Break down compile() function in todo.mdx package"
state: closed
priority: 1
type: chore
labels: ["refactor", "todo.mdx"]
createdAt: "2025-12-22T08:05:31.850Z"
updatedAt: "2025-12-22T08:12:13.520Z"
closedAt: "2025-12-22T08:12:13.520Z"
source: "beads"
---

# Break down compile() function in todo.mdx package

packages/todo.mdx/src/compiler.ts compile() function is 95 lines handling 7 concerns:
1. Template loading
2. Frontmatter parsing
3. Config merging
4. Loading issues from 4 sources
5. Issue merging/deduplication
6. Template hydration
7. Output generation

Extract into smaller focused functions for testability.

### Timeline

- **Created:** 12/22/2025
- **Updated:** 12/22/2025
- **Closed:** 12/22/2025
