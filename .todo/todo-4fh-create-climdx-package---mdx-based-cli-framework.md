---
id: todo-4fh
title: "Create cli.mdx package - MDX-based CLI framework"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-20T15:25:45.527Z"
updatedAt: "2025-12-20T17:16:25.471Z"
closedAt: "2025-12-20T17:16:25.471Z"
source: "beads"
---

# Create cli.mdx package - MDX-based CLI framework

MDX-based CLI framework for Bun with React (Ink-style) rendering:

CORE CONCEPT: Define CLIs in MDX, render to terminal AND markdown.

Features:
- Define CLI commands as MDX components
- React components render to terminal (like Ink)
- Same components render to markdown files
- Live data injection from beads, GitHub, APIs
- Multi-output: terminal, README.md, CLAUDE.md, .cursorrules

Built-in components:
- <Command name='build' /> - define CLI commands
- <Roadmap /> - render milestones + progress
- <Issues.Ready /> - render ready issues
- <Stats /> - render counts
- <Agent rules={...} /> - render AI instructions

Used by: todo.mdx, roadmap.mdx, readme.mdx, agents.mdx, claude.mdx

Tech: Bun + React + MDX + markdown output

### Related Issues

**Blocks:**
- **todo-15a**
- **todo-6a9**
- **todo-ac9**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
