---
id: todo-6i9r
title: "Approval gate configuration schema (org/repo/issue/PR levels)"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-21T18:43:07.924Z"
updatedAt: "2025-12-21T20:01:48.549Z"
closedAt: "2025-12-21T20:01:48.549Z"
source: "beads"
dependsOn: ["todo-3auj"]
blocks: ["todo-i6vs"]
---

# Approval gate configuration schema (org/repo/issue/PR levels)

Design and implement approval gate configuration that cascades:

```typescript
interface ApprovalConfig {
  // Who must approve before merge
  requireHumanApproval: boolean
  
  // When to require approval
  triggers: {
    labels?: string[]      // e.g., ['security', 'breaking-change']
    types?: string[]       // e.g., ['feature', 'refactor']
    filesChanged?: string[] // e.g., ['**/auth/**', 'package.json']
    riskScore?: number     // AI-assessed risk threshold
  }
  
  // Approvers
  approvers?: string[]     // GitHub usernames
  teamApprovers?: string[] // GitHub team slugs
}
```

Levels cascade: org → repo → issue labels → PR assessment

### Related Issues

**Depends on:**
- [todo-3auj](./todo-3auj.md)

**Blocks:**
- [todo-i6vs](./todo-i6vs.md)