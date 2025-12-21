---
id: todo-ree
title: "Add .mdx/ folder convention for MDX source files"
state: closed
priority: 1
type: feature
labels: []
---

# Add .mdx/ folder convention for MDX source files

Consolidate all MDX source files into .mdx/ folder to keep root clean.

Structure:
```
.mdx/
├── todo.mdx          → TODO.md
├── readme.mdx        → README.md
├── agents.mdx        → CLAUDE.md + .cursorrules + .github/copilot-instructions.md
├── roadmap.mdx       → ROADMAP.md
└── workflows/
    ├── develop.mdx
    └── standup.mdx
```

Priority order for file discovery:
1. .mdx/ folder (recommended)
2. Root files (TODO.mdx, etc.) for legacy/simple projects
3. Custom path via config

Remove need for separate .workflows/ folder - workflows live in .mdx/workflows/

Packages to update:
- todo.mdx: look for .mdx/todo.mdx first
- roadmap.mdx: look for .mdx/roadmap.mdx first
- agents.mdx: look for .mdx/agents.mdx first
- readme.mdx: look for .mdx/readme.mdx first
- CLI: init command creates .mdx/ folder

### Timeline

- **Created:** 12/20/2025

