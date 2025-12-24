---
id: todo-op30
title: "Missing error handling: removeLabel fails silently if label doesn't exist"
state: open
priority: 2
type: bug
labels: ["code-review", "error-handling", "worker"]
createdAt: "2025-12-24T11:15:39.038Z"
updatedAt: "2025-12-24T11:15:39.038Z"
source: "beads"
---

# Missing error handling: removeLabel fails silently if label doesn't exist

**File:** `/Users/nathanclevenger/projects/todo.mdx/worker/github-sync/github-client.ts:108-115`

**Problem:** The `removeLabel` method doesn't handle the case where the label doesn't exist on the issue. GitHub API returns a 404 in this case, which will throw an unhandled error.

**Code:**
```typescript
async removeLabel(owner: string, repo: string, number: number, label: string): Promise<void> {
  await octokit.rest.issues.removeLabel({
    owner,
    repo,
    issue_number: number,
    name: label,
  })  // Will throw 404 if label not present
}
```

**Impact:** When syncing label changes from beads to GitHub, if the label was already removed or never existed, the sync will fail with an unhandled error.

**Recommended Fix:** Catch 404 errors and handle gracefully:
```typescript
async removeLabel(owner: string, repo: string, number: number, label: string): Promise<void> {
  try {
    await octokit.rest.issues.removeLabel({
      owner,
      repo,
      issue_number: number,
      name: label,
    })
  } catch (error: any) {
    if (error.status !== 404) {
      throw error  // Re-throw non-404 errors
    }
    // 404 means label wasn't present - that's fine
  }
}
```