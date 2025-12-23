---
id: todo-ac9
title: "Create agents.mdx package"
state: closed
priority: 2
type: feature
labels: []
createdAt: "2025-12-20T15:25:31.013Z"
updatedAt: "2025-12-20T17:06:04.550Z"
closedAt: "2025-12-20T17:06:04.550Z"
source: "beads"
dependsOn: ["todo-4fh"]
---

# Create agents.mdx package

AGENTS.mdx template → multiple outputs:
- agents.md (human-readable agent docs)
- claude.md (Claude Code instructions)  
- .cursorrules (Cursor IDE rules)
- .github/copilot-instructions.md

Components: <Agent name='...' />, <Rules />, <Tools />, <Workflows />, <Capabilities />. 
Integrates with MCP tool definitions. Single source of truth for AI agent configuration across tools.

### Related Issues

**Depends on:**
- [todo-4fh](./todo-4fh.md)