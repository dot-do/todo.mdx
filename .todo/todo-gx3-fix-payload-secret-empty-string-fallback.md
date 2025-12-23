---
id: todo-gx3
title: "Fix PAYLOAD_SECRET empty string fallback"
state: closed
priority: 0
type: bug
labels: ["apps", "critical", "security"]
createdAt: "2025-12-20T20:02:19.896Z"
updatedAt: "2025-12-20T23:07:13.329Z"
closedAt: "2025-12-20T23:07:13.329Z"
source: "beads"
---

# Fix PAYLOAD_SECRET empty string fallback

In apps/admin/src/payload.config.ts:39, PAYLOAD_SECRET falls back to empty string which completely compromises JWT security. If env var is missing, auth tokens can be forged. Should throw error if missing or too short (<32 chars).

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
