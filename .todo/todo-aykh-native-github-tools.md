---
id: todo-aykh
title: "Native GitHub tools"
state: closed
priority: 1
type: task
labels: ["native", "tools"]
createdAt: "2025-12-21T14:59:18.157Z"
updatedAt: "2025-12-21T16:10:31.377Z"
closedAt: "2025-12-21T16:10:31.377Z"
source: "beads"
---

# Native GitHub tools

Implement native GitHub tools using existing GitHub App:

`worker/src/tools/native/github.ts`

Tools:
- github.createBranch({ repo, ref, sha? })
- github.createPullRequest({ repo, title, head, base, body? })
- github.addComment({ repo, issue, body })
- github.listIssues({ repo, state? })
- github.updateIssue({ repo, issue, title?, body?, state?, labels?, assignees? })
- github.addLabels({ repo, issue, labels })
- github.createLabel({ repo, name, color, description? })
- github.mergePullRequest({ repo, pull, method? })

Use existing getOctokit() helper with installation token from connection.

### Related Issues

**Depends on:**
- **todo-qd32**
- **todo-76xz**

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
