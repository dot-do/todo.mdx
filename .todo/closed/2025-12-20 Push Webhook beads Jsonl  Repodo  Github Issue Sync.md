---
id: todo-wds0
title: "Push webhook (beads JSONL) → RepoDO → GitHub Issue sync"
state: closed
priority: 1
type: task
labels: ["github", "sync", "worker"]
createdAt: "2025-12-20T23:32:10.761Z"
updatedAt: "2025-12-20T23:36:08.235Z"
closedAt: "2025-12-20T23:36:08.235Z"
source: "beads"
dependsOn: ["todo-8ufg", "todo-3zw8"]
---

# Push webhook (beads JSONL) → RepoDO → GitHub Issue sync

Handle git push webhooks when .beads/issues.jsonl changes, sync to GitHub Issues.

## Flow
1. Developer runs `bd create/update/close` locally
2. `git push` triggers push webhook
3. Worker detects .beads/issues.jsonl in changed files
4. RepoDO fetches and parses JSONL
5. Upserts to SQLite
6. Creates/updates corresponding GitHub Issues

## Implementation
```typescript
async onBeadsPush(payload: { commit: string; files: string[] }) {
  if (!payload.files.includes('.beads/issues.jsonl')) return
  
  // Fetch JSONL from GitHub
  const jsonl = await this.fetchGitHubFile('.beads/issues.jsonl', payload.commit)
  const issues = jsonl.split('\n').filter(Boolean).map(JSON.parse)
  
  for (const issue of issues) {
    // Upsert to SQLite
    const existing = this.getIssue(issue.id)
    this.upsertIssue(issue)
    
    // Sync to GitHub
    if (!existing) {
      await this.createGitHubIssue(issue)
    } else if (issue.updated_at > existing.updated_at) {
      await this.updateGitHubIssue(issue)
    }
  }
  
  // Handle deletions (issues in DB but not in JSONL)
  await this.syncDeletions(issues)
}

async createGitHubIssue(issue: Issue) {
  // POST /repos/{owner}/{repo}/issues
  const response = await fetch(`https://api.github.com/repos/${this.repoFullName}/issues`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title: issue.title,
      body: issue.description,
      labels: issue.labels,
      assignees: issue.assignee ? [issue.assignee] : [],
    })
  })
  
  // Store github_number back in DO
  const ghIssue = await response.json()
  this.sql.exec('UPDATE issues SET github_number = ? WHERE id = ?', ghIssue.number, issue.id)
}
```

## Files to modify
- `worker/src/do/repo.ts` - update processBeadsSync()
- `worker/src/index.ts` - push webhook routing

### Related Issues

**Depends on:**
- [todo-8ufg](./todo-8ufg.md)
- [todo-3zw8](./todo-3zw8.md)