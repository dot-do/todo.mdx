---
id: todo-78w
title: "Project visualization dashboard: Kanban, Gantt, Burndown charts"
state: open
priority: 1
type: epic
labels: [dashboard, shadcn, ui]
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
- **todo-38t**: Integrate shadcn Gantt chart for project timeline
- **todo-8h3**: Build burndown/velocity chart with Recharts
- **todo-djd**: Create unified project dashboard page with view switcher
- **todo-mf4**: Integrate shadcn-kanban-board for issue management

### Timeline

- **Created:** 12/20/2025

