---
id: todo-38t
title: "Integrate shadcn Gantt chart for project timeline"
state: closed
priority: 1
type: feature
labels: ["dashboard", "gantt", "shadcn"]
createdAt: "2025-12-20T20:13:26.363Z"
updatedAt: "2025-12-20T20:25:52.222Z"
closedAt: "2025-12-20T20:25:52.222Z"
source: "beads"
dependsOn: ["todo-78w"]
---

# Integrate shadcn Gantt chart for project timeline

Add Gantt chart visualization to dashboard for project timeline view.

**Recommended: shadcn.io Gantt component**
- Professional timeline visualization with interactive scheduling
- Uses date-fns for date arithmetic
- DND Kit for drag-and-drop scheduling
- Jotai for efficient state management
- Install: `npx shadcn@latest add https://www.shadcn.io/r/gantt`
- Docs: https://www.shadcn.io/components/data/gantt

**Implementation:**
1. Install the component
2. Map issues/milestones to Gantt rows
3. Use created_at → due_date for bar spans
4. Group by milestone or epic
5. Wire drag-drop to update dates via API
6. Add to dashboard at /dashboard/gantt route

**Alternatives:**
- Kibo UI Gantt: https://www.kibo-ui.com/components/gantt
- recharts-gantt-chart: https://github.com/rudrodip/recharts-gantt-chart

### Related Issues

**Depends on:**
- [todo-78w](./todo-78w.md)