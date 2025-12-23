---
id: todo-8y26
title: "Fix MCP /authorize endpoint returning 500 Internal Server Error"
state: closed
priority: 1
type: bug
labels: ["blocker", "e2e-testing", "mcp", "oauth"]
assignee: "claude-opus"
createdAt: "2025-12-21T13:01:51.107Z"
updatedAt: "2025-12-21T13:29:25.707Z"
closedAt: "2025-12-21T13:29:25.707Z"
source: "beads"
---

# Fix MCP /authorize endpoint returning 500 Internal Server Error

The MCP OAuth authorize endpoint at `https://todo.mdx.do/authorize` returns a 500 Internal Server Error, blocking the OAuth 2.1 flow needed for E2E testing.

**Reproduction:**
```bash
curl -s "https://todo.mdx.do/authorize?response_type=code&client_id=test&redirect_uri=http://localhost/cb&code_challenge=abc&code_challenge_method=S256&state=x"
# Returns: Internal Server Error (500)
```

**Location:** `worker/src/mcp/authkit-handler.ts` - GET /authorize handler

**Possible causes:**
- `OAUTH_PROVIDER.parseAuthRequest` failing
- `OAUTH_KV` not configured or accessible
- `COOKIE_ENCRYPTION_KEY` missing or invalid
- Client lookup failing

**Impact:** Blocks all authenticated MCP E2E tests

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
