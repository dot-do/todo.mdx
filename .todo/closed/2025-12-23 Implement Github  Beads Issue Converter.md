---
id: todo-4ygu
title: "Implement GitHub → Beads issue converter"
state: closed
priority: 1
type: task
labels: ["github-app", "phase-1"]
createdAt: "2025-12-23T13:37:07.271Z"
updatedAt: "2025-12-23T14:03:44.049Z"
closedAt: "2025-12-23T14:03:44.049Z"
source: "beads"
dependsOn: ["todo-o900", "todo-fx0p", "todo-v5yv"]
blocks: ["todo-qu6s"]
---

# Implement GitHub → Beads issue converter

Convert GitHub issue payloads to beads TodoIssue format using conventions.

## API
```typescript
interface ConvertOptions {
  conventions: GitHubConventions
  owner: string
  repo: string
}

function convertGitHubToBeads(
  ghIssue: GitHubIssue,
  options: ConvertOptions
): TodoIssue
```

## Field Mapping
| GitHub | Beads | Transform |
|--------|-------|-----------|
| `number` | `external_ref` | `github.com/{owner}/{repo}/issues/{number}` |
| `title` | `title` | Direct |
| `body` | `description` | Strip convention patterns |
| `state` | `status` | + label check for in_progress |
| `labels` | `type`, `priority`, `labels` | Via label mapper |
| `body` patterns | `dependsOn`, `blocks`, `parent` | Via convention parser |
| `assignee.login` | `assignee` | Direct |
| `created_at` | `createdAt` | ISO string |
| `updated_at` | `updatedAt` | ISO string |
| `closed_at` | `closedAt` | ISO string or null |

## Dependencies
- Convention parser (body patterns)
- Label mapper (type/priority/status)

### Related Issues

**Depends on:**
- [todo-o900](./todo-o900.md)
- [todo-fx0p](./todo-fx0p.md)
- [todo-v5yv](./todo-v5yv.md)

**Blocks:**
- [todo-qu6s](./todo-qu6s.md)