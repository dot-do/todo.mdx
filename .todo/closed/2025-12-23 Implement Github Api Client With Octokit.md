---
id: todo-44c0
title: "Implement GitHub API client with Octokit"
state: closed
priority: 2
type: task
labels: ["github-app", "phase-2"]
createdAt: "2025-12-23T13:37:23.400Z"
updatedAt: "2025-12-23T13:45:32.486Z"
closedAt: "2025-12-23T13:45:32.486Z"
source: "beads"
dependsOn: ["todo-v5yv"]
blocks: ["todo-qu6s"]
---

# Implement GitHub API client with Octokit

Create GitHub API client for issue CRUD operations with proper auth and rate limiting.

## API
```typescript
interface GitHubClient {
  // Issue operations
  createIssue(owner: string, repo: string, issue: GitHubIssuePayload): Promise<GitHubIssue>
  updateIssue(owner: string, repo: string, number: number, issue: Partial<GitHubIssuePayload>): Promise<GitHubIssue>
  closeIssue(owner: string, repo: string, number: number): Promise<void>
  reopenIssue(owner: string, repo: string, number: number): Promise<void>
  
  // Bulk operations
  listIssues(owner: string, repo: string, options?: ListOptions): Promise<GitHubIssue[]>
  
  // Labels
  addLabels(owner: string, repo: string, number: number, labels: string[]): Promise<void>
  removeLabel(owner: string, repo: string, number: number, label: string): Promise<void>
}

function createGitHubClient(installation: Installation): GitHubClient
```

## Implementation Notes
- Use `@octokit/rest` or `@octokit/core`
- Auto-refresh installation tokens before expiry
- Implement exponential backoff for rate limits
- Log API usage for debugging

## Rate Limit Handling
```typescript
async function withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  const result = await fn()
  const remaining = response.headers['x-ratelimit-remaining']
  if (remaining < 10) {
    await sleep(calculateBackoff(remaining))
  }
  return result
}
```

### Related Issues

**Depends on:**
- [todo-v5yv](./todo-v5yv.md)

**Blocks:**
- [todo-qu6s](./todo-qu6s.md)