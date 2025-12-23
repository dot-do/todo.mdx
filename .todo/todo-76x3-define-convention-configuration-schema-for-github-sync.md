---
id: todo-76x3
title: "Define convention configuration schema for GitHub sync"
state: closed
priority: 1
type: task
labels: ["foundation", "github-app"]
createdAt: "2025-12-23T13:36:40.442Z"
updatedAt: "2025-12-23T13:45:21.930Z"
closedAt: "2025-12-23T13:45:21.930Z"
source: "beads"
---

# Define convention configuration schema for GitHub sync

Define the configuration schema for customizable GitHub ↔ beads conventions in TODO.mdx.

## Schema Design
```typescript
interface GitHubConventions {
  // Label mappings
  labels: {
    type: Record<string, 'bug' | 'feature' | 'task' | 'epic' | 'chore'>
    priority: Record<string, 0 | 1 | 2 | 3 | 4>
    status: { inProgress?: string }  // e.g., 'status:in-progress'
  }
  
  // Markdown patterns for dependencies
  dependencies: {
    pattern: RegExp  // e.g., /Depends on:\s*(.+)/i
    separator: string  // e.g., ', '
  }
  
  // Epic/parent conventions
  epics: {
    labelPrefix?: string  // e.g., 'epic:'
    bodyPattern?: RegExp  // e.g., /Parent:\s*#(\d+)/
  }
}
```

## Default Conventions
- Type labels: `bug`, `enhancement`→feature, `task`, `epic`, `chore`
- Priority labels: `P0`, `P1`, `P2`, `P3`, `P4` (or `critical`, `high`, `medium`, `low`)
- Dependencies: `Depends on: #123, #456` in issue body
- Epics: `epic:name` label or `Parent: #123` in body

### Related Issues

**Depends on:**
- **todo-v5yv**

**Blocks:**
- **todo-fx0p**
- **todo-o900**

### Timeline

- **Created:** 12/23/2025
- **Updated:** 12/23/2025
- **Closed:** 12/23/2025
