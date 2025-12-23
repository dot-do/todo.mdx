---
id: todo-mf4
title: "Integrate shadcn-kanban-board for issue management"
state: closed
priority: 1
type: feature
labels: ["dashboard", "kanban", "shadcn"]
createdAt: "2025-12-20T20:13:26.271Z"
updatedAt: "2025-12-20T20:25:52.183Z"
closedAt: "2025-12-20T20:25:52.183Z"
source: "beads"
---

# Integrate shadcn-kanban-board for issue management

Add Kanban board visualization to dashboard for managing issues.

**Recommended: shadcn-kanban-board by janhesters**
- Zero dependencies, pure React
- Full keyboard controls + screen reader support
- Works with Next.js Server Actions
- Install: `bunx shadcn@latest add https://shadcn-kanban-board.com/r/kanban.json`
- GitHub: https://github.com/janhesters/shadcn-kanban-board
- Demo: https://www.shadcn-kanban-board.com/

**Implementation:**
1. Install the component
2. Create columns for: Open, In Progress, Blocked, Closed
3. Map beads issues to kanban cards
4. Wire drag-drop to update issue status via API
5. Add to dashboard at /dashboard/kanban route

**Alternative:** react-dnd-kit-tailwind-shadcn-ui if more customization needed
- GitHub: https://github.com/Georgegriff/react-dnd-kit-tailwind-shadcn-ui

### Related Issues

**Depends on:**
- **todo-78w**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
