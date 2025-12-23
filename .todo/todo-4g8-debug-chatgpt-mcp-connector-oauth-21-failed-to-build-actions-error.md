---
id: todo-4g8
title: "Debug ChatGPT MCP connector OAuth 2.1 \"Failed to build actions\" error"
state: closed
priority: 1
type: bug
labels: ["chatgpt", "mcp", "oauth"]
createdAt: "2025-12-20T18:47:27.518Z"
updatedAt: "2025-12-21T13:30:30.087Z"
closedAt: "2025-12-21T13:30:30.087Z"
source: "beads"
---

# Debug ChatGPT MCP connector OAuth 2.1 "Failed to build actions" error

ChatGPT returns "Error creating connector - Failed to build actions from MCP endpoint" when trying to connect to our MCP server.

## Current Implementation
- Uses `@cloudflare/workers-oauth-provider` at `worker/src/mcp/index.ts`
- OAuth endpoints at `/mcp/authorize`, `/mcp/token`, `/mcp/register`
- Discovery at `/mcp/.well-known/oauth-authorization-server`
- AuthKit handler for WorkOS integration

## ChatGPT Requirements (per research)

### 1. Discovery Endpoints
ChatGPT directly requests these (doesn't use WWW-Authenticate header):
- `/.well-known/oauth-authorization-server` ✅ (we have this)
- `/.well-known/oauth-protected-resource` ❓ (may be missing - RFC 9728)
- `/.well-known/openid-configuration` ❓ (fallback, may be needed)

### 2. Dynamic Client Registration (DCR)
ChatGPT registers a fresh OAuth client each time. Verify `/register` endpoint:
- Accepts POST with client metadata
- Returns `client_id` 
- Handles ChatGPT's specific metadata format

### 3. Required OAuth Metadata Fields
```json
{
  "issuer": "https://...",
  "authorization_endpoint": "...",
  "token_endpoint": "...",
  "registration_endpoint": "...",
  "code_challenge_methods_supported": ["S256"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "scopes_supported": ["openid", "profile", "..."]
}
```

### 4. Potential Issues
- CORS headers on discovery endpoints
- `scopes_supported` missing or wrong
- `code_challenge_methods_supported` not including S256
- Missing PKCE validation

## Testing Approach

### MCP Inspector
```bash
npx @modelcontextprotocol/inspector
# Navigate to http://localhost:6274
# Use AuthDebugger component for OAuth flow testing
```

### Manual Discovery Testing
```bash
# Test authorization server metadata
curl -v https://todo.mdx.do/mcp/.well-known/oauth-authorization-server

# Test protected resource metadata (if implemented)
curl -v https://todo.mdx.do/mcp/.well-known/oauth-protected-resource

# Test DCR endpoint
curl -X POST https://todo.mdx.do/mcp/register \
  -H "Content-Type: application/json" \
  -d '{"redirect_uris": ["https://chatgpt.com/callback"], "client_name": "Test"}'
```

### Check @cloudflare/workers-oauth-provider
Review what the provider actually exposes vs what ChatGPT expects.

## References
- [OpenAI MCP Connector OAuth Issues](https://community.openai.com/t/new-mcp-connector-does-not-follow-mcp-authorization-spec/1358992)
- [MCP Authorization Spec](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
- [WorkOS DCR in MCP](https://workos.com/blog/dynamic-client-registration-dcr-mcp-oauth)