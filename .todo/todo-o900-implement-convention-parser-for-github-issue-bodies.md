---
id: todo-o900
title: "Implement convention parser for GitHub issue bodies"
state: open
priority: 1
type: task
labels: ["github-app", "phase-1"]
createdAt: "2025-12-23T13:36:45.796Z"
updatedAt: "2025-12-23T13:36:45.796Z"
source: "beads"
---

# Implement convention parser for GitHub issue bodies

Parse GitHub issue bodies to extract beads-specific data using configurable conventions.

## Responsibilities
- Extract dependency references from markdown patterns
- Extract parent/epic references
- Handle various markdown formats (lists, inline, etc.)

## API
```typescript
interface ParsedConventions {
  dependsOn: string[]  // Issue numbers/refs extracted
  blocks: string[]
  parent?: string
  children?: string[]
}

function parseIssueBody(
  body: string,
  conventions: GitHubConventions
): ParsedConventions
```

## Test Cases
- `Depends on: #123, #456` → `dependsOn: ['123', '456']`
- `Depends on:\n- #123\n- #456` → same
- `Blocks: #789` → `blocks: ['789']`
- `Parent: #100` → `parent: '100'`
- Mixed formats in same body

### Related Issues

**Depends on:**
- **todo-76x3**
- **todo-v5yv**

**Blocks:**
- **todo-4ygu**
- **todo-aifu**

### Timeline

- **Created:** 12/23/2025
- **Updated:** 12/23/2025
