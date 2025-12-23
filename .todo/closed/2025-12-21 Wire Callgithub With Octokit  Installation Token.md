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
dependsOn: ["todo-d502"]
blocks: ["todo-dexj"]
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
- [todo-d502](./todo-d502.md)

**Blocks:**
- [todo-dexj](./todo-dexj.md)