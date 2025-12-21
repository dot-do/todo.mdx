---
id: todo-4fh
title: "Create cli.mdx package - MDX-based CLI framework"
state: closed
priority: 1
type: task
labels: []
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
- **todo-15a**: Create readme.mdx package
- **todo-6a9**: Create claude.mdx CLI package
- **todo-ac9**: Create agents.mdx package

### Timeline

- **Created:** 12/20/2025

