---
id: todo-8yk0
title: "Implement template slot interpolation with @mdxld/extract"
state: open
priority: 1
type: task
labels: ["phase-3", "templates"]
createdAt: "2025-12-23T13:45:41.116Z"
updatedAt: "2025-12-23T13:45:41.116Z"
source: "beads"
---

# Implement template slot interpolation with @mdxld/extract

Add renderTemplate(template, context) to src/templates.ts using parseTemplateSlots() from @mdxld/extract. Support {issue.field} syntax, nested access {issue.assignee.name}, array rendering, and conditional sections. Handle missing slots gracefully.

### Timeline

- **Created:** 12/23/2025
- **Updated:** 12/23/2025
