---
id: todo-8h3
title: "Build burndown/velocity chart with Recharts"
state: closed
priority: 1
type: feature
labels: ["analytics", "charts", "dashboard"]
createdAt: "2025-12-20T20:13:26.449Z"
updatedAt: "2025-12-20T20:25:52.266Z"
closedAt: "2025-12-20T20:25:52.266Z"
source: "beads"
dependsOn: ["todo-78w"]
---

# Build burndown/velocity chart with Recharts

Create burndown and velocity charts for sprint/project analytics.

**No specific shadcn burndown component exists - build custom with Recharts.**

Recharts is the charting library used by shadcn/ui charts.
- Docs: https://ui.shadcn.com/docs/components/chart
- Charts examples: https://ui.shadcn.com/charts/area

**Components to build:**

1. **Burndown Chart** (Area/Line chart)
   - X-axis: Sprint days/dates
   - Y-axis: Remaining issues/story points
   - Ideal line vs actual burndown
   - Shows if sprint is on track

2. **Velocity Chart** (Bar chart)
   - X-axis: Sprints/weeks
   - Y-axis: Issues closed / points completed
   - Rolling average line

3. **Cumulative Flow Diagram** (Stacked Area)
   - Shows issue count by status over time
   - Visualizes bottlenecks

**Data source:**
- Query closed_at timestamps from issues
- Group by day/week
- Calculate running totals

**Reference:** shadcn-event-timeline-roadmap has good analytics patterns
- GitHub: https://github.com/BunsDev/shadcn-event-timeline-roadmap

### Related Issues

**Depends on:**
- [todo-78w](./todo-78w.md)