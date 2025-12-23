---
id: todo-5b8a
title: "RepoDO → commit .beads/issues.jsonl to repo"
state: closed
priority: 1
type: task
labels: ["github", "sync", "worker"]
createdAt: "2025-12-20T23:31:31.537Z"
updatedAt: "2025-12-20T23:36:07.963Z"
closedAt: "2025-12-20T23:36:07.963Z"
source: "beads"
---

# RepoDO → commit .beads/issues.jsonl to repo

After DO state changes, commit updated JSONL back to the repository.

## Flow
1. DO state changes (from GitHub webhook or MCP tool)
2. Export all issues to JSONL format
3. Commit to repo via GitHub API

## Implementation
```typescript
async commitBeadsJsonl() {
  // Export current state to JSONL
  const issues = this.sql.exec('SELECT * FROM issues').toArray()
  const deps = this.sql.exec('SELECT * FROM dependencies').toArray()
  const labels = this.sql.exec('SELECT * FROM labels').toArray()
  
  // Build JSONL with embedded deps/labels (matching beads format)
  const jsonl = issues.map(issue => {
    const issueDeps = deps.filter(d => d.issue_id === issue.id)
    const issueLabels = labels.filter(l => l.issue_id === issue.id).map(l => l.label)
    return JSON.stringify({ ...issue, dependencies: issueDeps, labels: issueLabels })
  }).join('\n')
  
  // Commit via GitHub API
  const token = await this.getInstallationToken(this.installationId)
  await this.commitFile('.beads/issues.jsonl', jsonl, token)
}

async commitFile(path: string, content: string, token: string) {
  // Get current file SHA (if exists)
  // PUT /repos/{owner}/{repo}/contents/{path}
}
```

## Considerations
- Debounce commits (don't commit on every change)
- Include commit message with change summary
- Handle merge conflicts gracefully

### Related Issues

**Depends on:**
- **todo-8ufg**
- **todo-3zw8**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
