---
id: todo-djd
title: "Create unified project dashboard page with view switcher"
state: closed
priority: 1
type: feature
labels: ["dashboard", "ui"]
createdAt: "2025-12-20T20:13:26.537Z"
updatedAt: "2025-12-20T23:00:59.276Z"
closedAt: "2025-12-20T23:00:59.276Z"
source: "beads"
dependsOn: ["todo-78w"]
---

# Create unified project dashboard page with view switcher

Create the main project dashboard page that ties together all visualizations.

**Dashboard Layout:**
- View switcher tabs: List | Kanban | Gantt | Analytics
- Filter bar: Status, Priority, Assignee, Labels
- Quick stats cards: Open, In Progress, Blocked, Velocity

**Routes:**
- /dashboard/projects/[projectId] - main project view
- /dashboard/projects/[projectId]/kanban
- /dashboard/projects/[projectId]/gantt
- /dashboard/projects/[projectId]/analytics

**Components needed:**
- ViewSwitcher - tabs to switch between views
- FilterBar - filter controls using shadcn Command/Popover
- StatsCards - summary metrics
- IssueList - table view (already exists?)

**Data integration:**
- Fetch issues from Payload API
- Support filtering/sorting
- Real-time updates via polling or WebSocket

Location: apps/todo.mdx.do/app/dashboard/projects/

### Related Issues

**Depends on:**
- [todo-78w](./todo-78w.md)