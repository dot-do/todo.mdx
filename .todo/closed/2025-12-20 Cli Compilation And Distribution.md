---
id: todo-7s0
title: "CLI compilation and distribution"
state: closed
priority: 3
type: task
labels: []
createdAt: "2025-12-20T22:59:29.901Z"
updatedAt: "2025-12-20T23:32:30.536Z"
closedAt: "2025-12-20T23:32:30.536Z"
source: "beads"
dependsOn: ["todo-r1i", "todo-nsd"]
---

# CLI compilation and distribution

Package the CLI as a standalone binary and set up distribution.

**Build:**
```bash
bun build ./bin/sbx-stdio.ts --compile --outfile sbx-stdio
```

**Distribution options:**
- npm package: `@todo.mdx/sbx-cli`
- Standalone binaries for macOS/Linux (via bun compile)
- Homebrew formula (stretch goal)

**Files:**
- `packages/sbx-cli/package.json`
- Build scripts in package.json
- Consider: cross-platform builds

### Related Issues

**Depends on:**
- [todo-r1i](./todo-r1i.md)
- [todo-nsd](./todo-nsd.md)