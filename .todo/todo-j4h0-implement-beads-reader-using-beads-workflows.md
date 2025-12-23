---
id: todo-j4h0
title: "Implement beads reader using beads-workflows"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-23T10:10:19.254Z"
updatedAt: "2025-12-23T10:23:38.646Z"
closedAt: "2025-12-23T10:23:38.646Z"
source: "beads"
---

# Implement beads reader using beads-workflows

Create src/beads.ts:
- Use beads-workflows.readIssuesFromJsonl() to load issues
- Use beads-workflows.findBeadsDir() to locate .beads/
- Map beads Issue type to internal Issue type

This replaces the current beads reading logic with the npm package.

### Related Issues

**Depends on:**
- **todo-bf0d**

**Blocks:**
- **todo-oc5o**
- **todo-v5px**

### Timeline

- **Created:** 12/23/2025
- **Updated:** 12/23/2025
- **Closed:** 12/23/2025
