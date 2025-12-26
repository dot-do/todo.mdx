---
id: todo-g354
title: "Rewrite template system to use MDX components with @mdxld/markdown and @mdxld/extract"
state: open
priority: 1
type: bug
labels: ["architecture", "code-review", "src", "templates"]
createdAt: "2025-12-24T11:14:58.272Z"
updatedAt: "2025-12-26T11:39:46.335Z"
source: "beads"
blocks: ["todo-4y3r", "todo-b8iz", "todo-es3r", "todo-vong"]
---

# Rewrite template system to use MDX components with @mdxld/markdown and @mdxld/extract

**Current State:** Templates use simple string interpolation with `{path}` syntax and leftover handlebars cruft.

**Required Architecture:**

Templates should be **true MDX** with:
1. **JSX Components** like `<Issues.Blocked/>`, `<Issues.Ready/>`, `<Issue.Labels/>`
2. **Standard `{path}` expressions** for simple interpolation
3. **Arbitrary code execution** - full MDX/JavaScript capabilities

**Bi-directional Flow:**

```
Forward:  MDX Template + Props → Markdown    (@mdxld/markdown render())
Reverse:  Markdown + MDX Template → Props    (@mdxld/extract extract())
```

**Example Template (TODO.mdx):**

```mdx
# TODO

**Generated:** {timestamp}

## Summary

- Total: {issues.length}
- Open: {openCount}

## Blocked Issues

<Issues.Blocked />

## Ready to Work

<Issues.Ready limit={10} />

## All Open Issues

<Issues status="open" columns={['id', 'title', 'priority']} />
```

**Implementation:**

1. **Rendering**: Use `render(template, data)` from `@mdxld/markdown`
2. **Extraction**: Use `extract({ template, rendered })` from `@mdxld/extract`
3. **Components**: Create `roundTripComponent` definitions for each component

**Components Needed:**

| Component | Render | Extract |
|-----------|--------|---------|
| `<Issues />` | Table of issues | Parse table rows back to issue props |
| `<Issues.Blocked />` | Blocked issues table | Extract blocked issues |
| `<Issues.Ready />` | Ready issues table | Extract ready issues |
| `<Issue.Labels />` | Label badges | Parse labels |
| `<Issue.Dependencies />` | Dependency list | Parse deps |

**Files to Change:**

- `src/templates.ts` - Complete rewrite
- `src/components/` - New directory for MDX components
- `tests/template-*.test.ts` - Update tests

### Related Issues

**Blocks:**
- [todo-4y3r](./todo-4y3r.md)
- [todo-b8iz](./todo-b8iz.md)
- [todo-es3r](./todo-es3r.md)
- [todo-vong](./todo-vong.md)