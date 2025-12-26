---
id: todo-vong
title: "Create roundTripComponent definitions for MDX issue components"
state: open
priority: 1
type: task
labels: ["components", "mdx", "templates"]
createdAt: "2025-12-26T11:40:26.594Z"
updatedAt: "2025-12-26T11:40:26.594Z"
source: "beads"
dependsOn: ["todo-g354"]
blocks: ["todo-4y3r", "todo-b8iz", "todo-es3r"]
---

# Create roundTripComponent definitions for MDX issue components

Create bi-directional MDX components using `roundTripComponent` from `@mdxld/extract`.

**Components to create:**

```typescript
// src/components/issues.ts
import { roundTripComponent } from '@mdxld/extract'

export const Issues = roundTripComponent({
  render: (props: { items: Issue[], columns?: string[], status?: string }) => {
    // Render issues as markdown table
    const header = '| ' + columns.join(' | ') + ' |'
    const sep = '|' + columns.map(() => '---').join('|') + '|'
    const rows = items.map(i => '| ' + columns.map(c => i[c]).join(' | ') + ' |')
    return [header, sep, ...rows].join('\n')
  },
  extract: (content: string) => {
    // Parse markdown table back to issue props
    // Use table parsing from @mdxld/markdown conventions
  }
})

Issues.Blocked = roundTripComponent({
  render: (props) => Issues.render({ ...props, status: 'blocked' }),
  extract: (content) => ({ ...Issues.extract(content), status: 'blocked' })
})

Issues.Ready = roundTripComponent({...})
```

**Sub-components:**
- `<Issues />` - Generic issue table with filters
- `<Issues.Blocked />` - Blocked issues only
- `<Issues.Ready />` - Ready (unblocked) issues only
- `<Issues.Open />` - Open issues
- `<Issues.Closed />` - Closed issues
- `<Issue.Labels />` - Render labels as badges
- `<Issue.Dependencies />` - Render dependency links

### Related Issues

**Depends on:**
- [todo-g354](./todo-g354.md)

**Blocks:**
- [todo-4y3r](./todo-4y3r.md)
- [todo-b8iz](./todo-b8iz.md)
- [todo-es3r](./todo-es3r.md)