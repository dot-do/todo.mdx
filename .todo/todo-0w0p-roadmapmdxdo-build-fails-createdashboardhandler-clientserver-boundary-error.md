---
id: todo-0w0p
title: "roadmap.mdx.do build fails: createDashboardHandler client/server boundary error"
state: closed
priority: 1
type: bug
labels: []
createdAt: "2025-12-21T14:31:30.817Z"
updatedAt: "2025-12-21T14:38:46.550Z"
closedAt: "2025-12-21T14:38:46.550Z"
source: "beads"
---

# roadmap.mdx.do build fails: createDashboardHandler client/server boundary error

Build of @todo.mdx/roadmap.mdx.do failing in CI with:

Error: Attempted to call createDashboardHandler() from the server but createDashboardHandler is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.

This is a React Server Components boundary violation.

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
