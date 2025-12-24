---
id: todo-2tj0
title: "Missing error handling: GitHub API pagination not implemented"
state: open
priority: 1
type: bug
labels: ["code-review", "data-loss", "worker"]
createdAt: "2025-12-24T11:15:17.738Z"
updatedAt: "2025-12-24T11:15:17.738Z"
source: "beads"
---

# Missing error handling: GitHub API pagination not implemented

**File:** `/Users/nathanclevenger/projects/todo.mdx/worker/github-sync/github-client.ts:90-97`

**Problem:** The `listIssues` method does not handle GitHub API pagination. GitHub returns at most 100 issues per page by default. Repositories with more than 100 issues will have incomplete sync.

**Code:**
```typescript
async listIssues(owner: string, repo: string, options?: { state?: 'open' | 'closed' | 'all', per_page?: number }): Promise<GitHubIssue[]> {
  const response = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    ...filterUndefined(options || {}),
  })
  return response.data as GitHubIssue[]  // Only returns first page!
}
```

**Impact:** Syncing will miss issues in repositories with more than 100 issues, causing silent data loss.

**Recommended Fix:** Implement pagination using Octokit's paginate helper:
```typescript
async listIssues(owner: string, repo: string, options?: { state?: 'open' | 'closed' | 'all', per_page?: number }): Promise<GitHubIssue[]> {
  return await octokit.paginate(octokit.rest.issues.listForRepo, {
    owner,
    repo,
    per_page: 100,
    ...filterUndefined(options || {}),
  }) as GitHubIssue[]
}
```