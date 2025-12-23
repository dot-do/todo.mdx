---
id: todo-29oj
title: "Product Priya: Planner Agent for Autonomous Roadmap Management"
state: closed
priority: 1
type: epic
labels: []
createdAt: "2025-12-22T11:48:34.528Z"
updatedAt: "2025-12-22T14:25:41.981Z"
closedAt: "2025-12-22T14:25:41.981Z"
source: "beads"
---

# Product Priya: Planner Agent for Autonomous Roadmap Management

Planner Agent that handles roadmap, planning, and agent assignment.

## Scope
Operates at Project level (GitHub Projects sync, can span repos).

## Triggers
**Event-driven:**
- issue.closed → find next ready, assign agent
- epic.completed → close epic, plan next phase
- issue.blocked → flag, reassign agent
- pr.merged → verify issue closure

**Scheduled:**
- Daily standup → status summary
- Weekly planning → groom backlog

**On-demand:**
- 'Priya, review the roadmap'
- 'Priya, plan next sprint'

## Core Capabilities
- DAG analysis: find ready issues, critical path
- Agent matching: issue requirements → best-fit agent
- Dependency review: suggest missing deps on issue.created
- Capacity-aware: no artificial limits, DAG is the throttle

### Related Issues

**Depends on:**
- **todo-u7dw**

**Blocks:**
- **todo-4ouv**
- **todo-cob2**
- **todo-cq7h**
- **todo-hqe8**
- **todo-xi5y**
- **todo-zxgz**

### Timeline

- **Created:** 12/22/2025
- **Updated:** 12/22/2025
- **Closed:** 12/22/2025
