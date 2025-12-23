---
id: todo-zow4
title: "CI: admin build fails - wrangler login required"
state: closed
priority: 0
type: bug
labels: []
createdAt: "2025-12-21T14:21:12.816Z"
updatedAt: "2025-12-21T14:22:33.650Z"
closedAt: "2025-12-21T14:22:33.650Z"
source: "beads"
---

# CI: admin build fails - wrangler login required

The admin app build fails in CI because it requires wrangler to be logged in:

Error: You must be logged in to use wrangler dev in remote mode.

This happens during the Next.js build step when collecting page data for /api/graphql-playground.

The build uses @opennextjs/cloudflare which may be trying to start a wrangler dev session.

Fix options:
1. Add CLOUDFLARE_API_TOKEN to CI secrets
2. Configure build to use local mode (--local) 
3. Skip the graphql-playground route during build

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
