---
id: todo-dzo
title: "Deploy MCP server at todo.mdx.do/mcp with WorkOS AuthKit"
state: closed
priority: 0
type: feature
labels: []
createdAt: "2025-12-20T17:41:38.961Z"
updatedAt: "2025-12-20T18:11:59.231Z"
closedAt: "2025-12-20T18:11:59.231Z"
source: "beads"
---

# Deploy MCP server at todo.mdx.do/mcp with WorkOS AuthKit

Deploy remote MCP server with OAuth 2.1 authentication using WorkOS AuthKit.

## Completed:
✅ Admin app type errors fixed
✅ Token storage migrated to D1 (migrations/0002_mcp_tokens.sql, 0003_mcp_oauth_state.sql)
✅ WorkOS AuthKit OAuth flow integrated (auth/authkit.ts)
✅ Payload RPC service binding enabled in wrangler.jsonc

## Remaining Deployment Steps:

1. **Deploy admin-todo-mdx first** (required for PAYLOAD service binding)
   ```bash
   cd apps/admin && wrangler deploy
   ```

2. **Run D1 migrations on worker**
   ```bash
   cd worker && wrangler d1 migrations apply todo-mdx
   ```

3. **Set WorkOS secrets**
   ```bash
   wrangler secret put WORKOS_API_KEY
   wrangler secret put WORKOS_CLIENT_ID
   wrangler secret put WORKOS_CLIENT_SECRET
   ```

4. **Configure WorkOS AuthKit callback URL**
   In WorkOS dashboard, add redirect URI: `https://todo-mdx.do/mcp/callback`

5. **Deploy worker**
   ```bash
   cd worker && wrangler deploy
   ```

6. **Test OAuth flow**
   Connect via MCP client to `https://todo-mdx.do/mcp`

## Files Changed:
- worker/src/mcp/index.ts - OAuth flow with WorkOS AuthKit
- worker/src/mcp/token-store.ts - D1 token persistence
- worker/src/auth/authkit.ts - WorkOS AuthKit helpers
- worker/migrations/0002_mcp_tokens.sql - Token tables
- worker/migrations/0003_mcp_oauth_state.sql - OAuth state table
- apps/admin/src/payload.config.ts - Fixed type errors
- worker/wrangler.jsonc - Enabled Payload RPC binding

### Related Issues

**Depends on:**
- **todo-nkz**
- **todo-q2h**
- **todo-1vj**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
