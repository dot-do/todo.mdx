---
id: todo-fx0p
title: "Implement label mapper for type/priority/status"
state: closed
priority: 1
type: task
labels: ["github-app", "phase-1"]
createdAt: "2025-12-23T13:36:51.173Z"
updatedAt: "2025-12-23T13:55:39.290Z"
closedAt: "2025-12-23T13:55:39.290Z"
source: "beads"
dependsOn: ["todo-76x3", "todo-v5yv"]
blocks: ["todo-4ygu", "todo-aifu"]
---

# Implement label mapper for type/priority/status

Map GitHub labels to beads type, priority, and status fields using configurable conventions.

## API
```typescript
interface MappedFields {
  type: 'bug' | 'feature' | 'task' | 'epic' | 'chore'
  priority: 0 | 1 | 2 | 3 | 4
  status: 'open' | 'in_progress' | 'closed'
  remainingLabels: string[]  // Labels not consumed by mapping
}

function mapLabels(
  labels: string[],
  githubState: 'open' | 'closed',
  conventions: GitHubConventions
): MappedFields
```

## Default Mappings
- `bug` → type: 'bug'
- `enhancement` → type: 'feature'
- `P0`/`critical` → priority: 0
- `status:in-progress` + state:open → status: 'in_progress'

## Test Cases
- `['bug', 'P1']` → `{ type: 'bug', priority: 1, status: 'open' }`
- `['enhancement', 'status:in-progress']` → `{ type: 'feature', status: 'in_progress' }`
- Unknown labels pass through to `remainingLabels`

### Related Issues

**Depends on:**
- [todo-76x3](./todo-76x3.md)
- [todo-v5yv](./todo-v5yv.md)

**Blocks:**
- [todo-4ygu](./todo-4ygu.md)
- [todo-aifu](./todo-aifu.md)