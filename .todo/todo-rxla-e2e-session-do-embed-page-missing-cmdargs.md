---
id: todo-rxla
title: "E2E: Session DO embed page missing cmd/args"
state: closed
priority: 1
type: bug
labels: []
createdAt: "2025-12-21T14:09:35.082Z"
updatedAt: "2025-12-21T14:18:52.868Z"
closedAt: "2025-12-21T14:18:52.868Z"
source: "beads"
---

# E2E: Session DO embed page missing cmd/args

test: session-do.test.ts

The embed page test is failing because the returned HTML doesn't contain the expected cmd and args data.

Expected: HTML should contain '"node"' and '["-v"]'
Actual: HTML contains WorkOS sign-in page instead of session embed

This suggests the session embed endpoint is redirecting to auth when it should render the session page.

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
