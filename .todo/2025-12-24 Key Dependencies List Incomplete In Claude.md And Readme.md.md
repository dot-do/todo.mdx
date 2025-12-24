---
id: todo-f6g2
title: "Key dependencies list incomplete in CLAUDE.md and README.md"
state: open
priority: 3
type: task
labels: ["code-review", "docs"]
createdAt: "2025-12-24T11:15:14.806Z"
updatedAt: "2025-12-24T11:15:14.806Z"
source: "beads"
---

# Key dependencies list incomplete in CLAUDE.md and README.md

Both documentation files list key dependencies but omit important packages that are actually used:

**CLAUDE.md (lines 94-99) mentions:**
- beads-workflows
- @mdxld/markdown
- @mdxld/extract  
- chokidar

**README.md (lines 220-226) mentions:**
- beads-workflows
- @mdxld/markdown
- chokidar
- db.td
- @todo-mdx/github-sync

**Missing from both:**
- @octokit/rest - Used for GitHub API integration
- hono - Used for HTTP routing in the worker

**Note:** README mentions @todo-mdx/github-sync but this appears to be incorrect - the actual code is in worker/github-sync/ directory.

This inconsistency could confuse developers about the actual project dependencies.