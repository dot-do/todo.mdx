---
id: todo-yy2h
title: "Wire callGitHub() with Octokit + installation token"
state: closed
priority: 0
type: task
labels: []
createdAt: "2025-12-21T18:41:16.091Z"
updatedAt: "2025-12-21T19:07:12.879Z"
closedAt: "2025-12-21T19:07:12.879Z"
source: "beads"
---

# Wire callGitHub() with Octokit + installation token

Route `callGitHub()` in agents.mdx cloud transport to use Octokit with GitHub App installation token.

Currently throws: `throw new Error('callGitHub not implemented')`

Implementation:
1. Get installation token from GitHub App
2. Create Octokit instance with token
3. Execute requested GitHub API operation
4. Handle PR creation, comments, merges

### Related Issues

**Depends on:**
- **todo-d502**

**Blocks:**
- **todo-dexj**

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
