---
id: todo-nof
title: "admin.mdx.do/admin returns 500 - missing PAYLOAD_SECRET"
state: closed
priority: 1
type: bug
labels: []
---

# admin.mdx.do/admin returns 500 - missing PAYLOAD_SECRET

The admin dashboard at https://admin.mdx.do/admin is returning a 500 error.

Worker logs show:
```
Error: missing secret key. A secret key is needed to secure Payload.
```

Root cause: The `PAYLOAD_SECRET` environment variable is not set on the deployed Cloudflare Worker.

### Timeline

- **Created:** 12/20/2025

