---
id: todo-0tb9
title: "GitHub Issue webhook → RepoDO upsert"
state: closed
priority: 1
type: task
labels: ["github", "sync", "worker"]
createdAt: "2025-12-20T23:31:31.280Z"
updatedAt: "2025-12-20T23:36:07.918Z"
closedAt: "2025-12-20T23:36:07.918Z"
source: "beads"
---

# GitHub Issue webhook → RepoDO upsert

Handle GitHub Issues webhooks and upsert to RepoDO SQLite.

## Webhook Events to Handle
- `issues.opened` - create issue in DO
- `issues.edited` - update issue in DO
- `issues.closed` - mark closed in DO
- `issues.reopened` - mark open in DO
- `issues.labeled` / `issues.unlabeled` - update labels
- `issues.assigned` / `issues.unassigned` - update assignee
- `issue_comment.created` - add comment

## Implementation
```typescript
async onGitHubIssue(payload: GitHubIssueEvent) {
  const issue = {
    id: `gh-${payload.issue.number}`, // or generate beads-style ID
    title: payload.issue.title,
    description: payload.issue.body || '',
    status: payload.issue.state === 'closed' ? 'closed' : 'open',
    github_number: payload.issue.number,
    github_id: payload.issue.id,
    // ... map other fields
  }
  
  this.sql.exec(`
    INSERT INTO issues (...) VALUES (...)
    ON CONFLICT(id) DO UPDATE SET ...
  `, ...)
}
```

## Files to modify
- `worker/src/do/repo.ts` - add/update processGithubSync()
- `worker/src/index.ts` - route webhook to correct RepoDO

### Related Issues

**Depends on:**
- **todo-8ufg**
- **todo-3zw8**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
