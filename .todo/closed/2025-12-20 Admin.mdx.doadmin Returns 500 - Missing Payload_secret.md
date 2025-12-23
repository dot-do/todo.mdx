---
id: todo-nof
title: "admin.mdx.do/admin returns 500 - missing PAYLOAD_SECRET"
state: closed
priority: 1
type: bug
labels: []
createdAt: "2025-12-20T19:13:13.296Z"
updatedAt: "2025-12-20T19:14:49.238Z"
closedAt: "2025-12-20T19:14:49.238Z"
source: "beads"
---

# admin.mdx.do/admin returns 500 - missing PAYLOAD_SECRET

The admin dashboard at https://admin.mdx.do/admin is returning a 500 error.

Worker logs show:
```
Error: missing secret key. A secret key is needed to secure Payload.
```

Root cause: The `PAYLOAD_SECRET` environment variable is not set on the deployed Cloudflare Worker.