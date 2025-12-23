---
id: todo-96if
title: "Extract GitHub installation token generation to shared utility"
state: closed
priority: 1
type: chore
labels: ["dedup", "refactor", "worker"]
createdAt: "2025-12-22T08:05:15.806Z"
updatedAt: "2025-12-22T08:12:33.797Z"
closedAt: "2025-12-22T08:12:33.797Z"
source: "beads"
---

# Extract GitHub installation token generation to shared utility

GitHub installation token generation is duplicated 3+ times across:
- worker/src/do/repo.ts (lines 415-445)
- worker/src/do/project.ts (lines 295-367)
- worker/src/do/pr.ts (lines 1370-1380)

Create worker/src/utils/github-auth.ts with a single getInstallationToken() function.

### Timeline

- **Created:** 12/22/2025
- **Updated:** 12/22/2025
- **Closed:** 12/22/2025
