---
id: todo-nahq
title: "Test improvement: Missing error path tests in github-client.test.ts"
state: open
priority: 2
type: task
labels: ["code-review", "test-coverage", "tests"]
createdAt: "2025-12-24T11:15:35.952Z"
updatedAt: "2025-12-24T11:15:35.952Z"
source: "beads"
---

# Test improvement: Missing error path tests in github-client.test.ts

**Location:** /Users/nathanclevenger/projects/todo.mdx/worker/github-sync/tests/github-client.test.ts

**Problem:** The GitHub client tests only test happy paths where API calls succeed. There are no tests for:

1. **API rate limiting** - What happens when GitHub returns 429?
2. **Authentication failures** - What happens with expired tokens?
3. **Network errors** - Connection timeouts, DNS failures
4. **Invalid responses** - Malformed JSON, missing fields
5. **Error propagation** - How errors bubble up to callers

**Example of missing coverage:**
```typescript
// No test like this exists:
it('should handle API rate limiting gracefully', async () => {
  mockOctokit.rest.issues.create.mockRejectedValue({
    status: 429,
    headers: { 'retry-after': '60' }
  })
  await expect(client.createIssue(...)).rejects.toThrow('Rate limited')
})
```

**Recommendation:** Add error scenario tests for each client method.