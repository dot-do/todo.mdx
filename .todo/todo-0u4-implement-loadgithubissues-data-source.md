---
id: todo-0u4
title: "Implement loadGitHubIssues() data source"
state: closed
priority: 2
type: feature
labels: ["github", "todo.mdx"]
createdAt: "2025-12-20T20:09:19.957Z"
updatedAt: "2025-12-20T23:10:25.271Z"
closedAt: "2025-12-20T23:10:25.271Z"
source: "beads"
---

# Implement loadGitHubIssues() data source

Add GitHub Issues as a data source for todo.mdx compiler.

roadmap.mdx already has GitHub milestone loading - adapt for issues:
- Fetch issues via GitHub API or Octokit
- Map GitHub issue fields to Issue type
- Support repo configuration
- Handle pagination
- Cache results

This allows rendering GitHub issues as .todo/*.mdx without beads.

Location: packages/todo.mdx/src/compiler.ts, add loadGitHubIssues()

### Related Issues

**Depends on:**
- **todo-kxl**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
