---
id: todo-b8qe
title: "todo.mdx v2: Simplified Single-Package Architecture"
state: closed
priority: 0
type: epic
labels: []
createdAt: "2025-12-23T10:09:57.918Z"
updatedAt: "2025-12-23T10:44:01.720Z"
closedAt: "2025-12-23T10:44:01.720Z"
source: "beads"
---

# todo.mdx v2: Simplified Single-Package Architecture

Reset todo.mdx to a single npm package focused on bi-directional sync between:
- .beads/issues.jsonl (beads tracker)
- .todo/*.md files (markdown issue files)  
- TODO.md (compiled output)

Dependencies:
- beads-workflows (npm) - Read/write beads issues
- @mdxld/markdown - Bi-directional object ↔ markdown conversion
- @mdxld/extract - Extract structured data from rendered content

Old monorepo complexity moved to v1 branch.

### Timeline

- **Created:** 12/23/2025
- **Updated:** 12/23/2025
- **Closed:** 12/23/2025
