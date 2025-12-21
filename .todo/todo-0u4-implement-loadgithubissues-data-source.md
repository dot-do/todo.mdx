---
id: todo-0u4
title: "Implement loadGitHubIssues() data source"
state: open
priority: 2
type: feature
labels: [github, todo.mdx]
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

### Timeline

- **Created:** 12/20/2025

