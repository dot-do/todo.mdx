---
id: todo-38t
title: "Integrate shadcn Gantt chart for project timeline"
state: open
priority: 1
type: feature
labels: [dashboard, gantt, shadcn]
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

### Timeline

- **Created:** 12/20/2025

