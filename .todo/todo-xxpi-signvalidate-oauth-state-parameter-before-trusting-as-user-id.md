---
id: todo-xxpi
title: "Sign/validate OAuth state parameter before trusting as user ID"
state: closed
priority: 2
type: bug
labels: ["oauth", "security"]
createdAt: "2025-12-22T00:24:18.955Z"
updatedAt: "2025-12-22T00:34:52.776Z"
closedAt: "2025-12-22T00:34:52.776Z"
source: "beads"
---

# Sign/validate OAuth state parameter before trusting as user ID

GitHub callback trusts state parameter directly as user ID without verification. Attacker could manipulate this to link an installation to an arbitrary user account.

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
