---
id: todo-78w
title: "Project visualization dashboard: Kanban, Gantt, Burndown charts"
state: closed
priority: 1
type: epic
labels: ["dashboard", "shadcn", "ui"]
createdAt: "2025-12-20T20:12:55.168Z"
updatedAt: "2025-12-20T23:01:06.839Z"
closedAt: "2025-12-20T23:01:06.839Z"
source: "beads"
blocks: ["todo-38t", "todo-8h3", "todo-djd", "todo-mf4"]
---

# Project visualization dashboard: Kanban, Gantt, Burndown charts

Add project visualization UI to the dashboard using shadcn components.

Research findings:

**Kanban Board Options:**
- shadcn-kanban-board (janhesters) - zero deps, keyboard accessible, Next.js Server Actions
  Install: `bunx shadcn@latest add https://shadcn-kanban-board.com/r/kanban.json`
- react-dnd-kit-tailwind-shadcn-ui (Georgegriff) - dnd-kit based

**Gantt Chart Options:**
- shadcn.io Gantt - uses date-fns, dnd-kit, jotai
  Install: `npx shadcn@latest add https://www.shadcn.io/r/gantt`
- Kibo UI Gantt - hierarchical view
- recharts-gantt-chart - built on recharts

**Burndown Chart:**
- No specific shadcn component - build custom with Recharts (shadcn charts foundation)
- Can use shadcn-event-timeline-roadmap as inspiration (has progress analytics)

All components should integrate with beads/API issue data.

### Related Issues

**Blocks:**
- [todo-38t](./todo-38t.md)
- [todo-8h3](./todo-8h3.md)
- [todo-djd](./todo-djd.md)
- [todo-mf4](./todo-mf4.md)