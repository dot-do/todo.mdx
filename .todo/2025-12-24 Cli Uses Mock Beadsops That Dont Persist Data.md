---
id: todo-dp5x
title: "CLI uses mock beadsOps that don't persist data"
state: open
priority: 1
type: bug
labels: ["code-review", "incomplete", "worker"]
createdAt: "2025-12-24T11:15:44.385Z"
updatedAt: "2025-12-24T11:15:44.385Z"
source: "beads"
---

# CLI uses mock beadsOps that don't persist data

**File:** `/Users/nathanclevenger/projects/todo.mdx/worker/github-sync/cli.ts:158-176`

**Problem:** The CLI `sync` command creates an orchestrator with mock operations that don't actually persist any data to beads.

**Code:**
```typescript
const orchestrator = createOrchestrator({
  // ...
  beadsOps: {
    getIssue: async (_id: string) => null,
    createIssue: async (issue: any) => issue,  // Returns input, doesn't persist
    updateIssue: async (id: string, issue: any) => ({ ...issue, id }) as any,  // No persistence
    listIssues: async () => [],  // Always empty
  },
  mappingOps: {
    getMapping: async (_beadsId: string) => null,
    getMappingByGitHub: async (_number: number) => null,
    createMapping: async (mapping: any) => ({ $type: 'IssueMapping', $id: 'mock-mapping', ...mapping }),
    updateMapping: async (id: string, data: any) => ({ $type: 'IssueMapping', $id: id, ...data }) as any,
  },
})
```

**Impact:** 
- Running `sync` via CLI will pull GitHub issues but never save them to beads
- Push operations will find no issues to push
- The CLI appears to work but does nothing useful

**Recommended Fix:** The CLI needs to be wired up to actual beads operations. This requires:
1. Reading/writing to the beads database (likely via beads-workflows)
2. Persisting mappings to a local store or the beads database