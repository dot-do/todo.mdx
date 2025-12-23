---
id: todo-aifu
title: "Implement Beads → GitHub issue converter"
state: closed
priority: 2
type: task
labels: ["github-app", "phase-2"]
createdAt: "2025-12-23T13:37:12.648Z"
updatedAt: "2025-12-23T14:03:49.345Z"
closedAt: "2025-12-23T14:03:49.345Z"
source: "beads"
dependsOn: ["todo-o900", "todo-fx0p", "todo-v5yv"]
blocks: ["todo-qu6s"]
---

# Implement Beads → GitHub issue converter

Convert beads TodoIssue to GitHub issue format, injecting convention patterns.

## API
```typescript
interface GitHubIssuePayload {
  title: string
  body: string
  labels: string[]
  assignees: string[]
  state?: 'open' | 'closed'
}

function convertBeadsToGitHub(
  issue: TodoIssue,
  conventions: GitHubConventions
): GitHubIssuePayload
```

## Transformations
- **Type → Label**: `bug` → `bug`, `feature` → `enhancement`
- **Priority → Label**: `0` → `P0`, `1` → `P1`, etc.
- **Status → Label**: `in_progress` → `status:in-progress`
- **Dependencies → Body**: Append `\n\nDepends on: #123, #456`
- **Parent → Body**: Append `\nParent: #100`

## Body Generation
```markdown
{original description}

---
<!-- beads-sync metadata - do not edit below -->
Depends on: #123, #456
Blocks: #789
Parent: #100
```

## Test Cases
- Round-trip: GitHub → Beads → GitHub preserves data
- Dependencies formatted correctly
- Labels deduplicated

### Related Issues

**Depends on:**
- [todo-o900](./todo-o900.md)
- [todo-fx0p](./todo-fx0p.md)
- [todo-v5yv](./todo-v5yv.md)

**Blocks:**
- [todo-qu6s](./todo-qu6s.md)