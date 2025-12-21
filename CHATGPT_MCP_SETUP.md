# ChatGPT MCP Connector Setup

This document describes the OAuth 2.1 implementation for ChatGPT MCP connector integration.

## Implementation Summary

We've implemented a fully compliant OAuth 2.1 + PKCE flow with the following key components:

### 1. RFC 9728: OAuth 2.0 Protected Resource Metadata

**Endpoint**: `https://todo.mdx.do/.well-known/oauth-protected-resource`

This endpoint is **critical** for ChatGPT to discover the authorization server. Per RFC 9728, this provides:

```json
{
  "resource": "https://todo.mdx.do",
  "authorization_servers": ["https://todo.mdx.do"],
  "scopes_supported": [
    "openid",
    "profile",
    "email",
    "todo:read",
    "todo:write",
    "issues:read",
    "issues:write",
    "roadmap:read"
  ],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://todo.mdx.do/docs"
}
```

### 2. RFC 8414: OAuth Authorization Server Metadata

**Endpoint**: `https://todo.mdx.do/.well-known/oauth-authorization-server`

Enhanced version with all required fields for ChatGPT:

```json
{
  "issuer": "https://todo.mdx.do",
  "authorization_endpoint": "https://todo.mdx.do/authorize",
  "token_endpoint": "https://todo.mdx.do/token",
  "registration_endpoint": "https://todo.mdx.do/register",
  "response_types_supported": ["code"],
  "response_modes_supported": ["query"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "token_endpoint_auth_methods_supported": [
    "client_secret_basic",
    "client_secret_post",
    "none"
  ],
  "code_challenge_methods_supported": ["S256", "plain"],
  "scopes_supported": [
    "openid",
    "profile",
    "email",
    "todo:read",
    "todo:write",
    "issues:read",
    "issues:write",
    "roadmap:read"
  ],
  "revocation_endpoint": "https://todo.mdx.do/token",
  "service_documentation": "https://todo.mdx.do/docs",
  "ui_locales_supported": ["en-US"]
}
```

**Key fields ChatGPT requires:**
- `code_challenge_methods_supported` with `["S256"]` - for PKCE
- `scopes_supported` - complete list of available scopes
- `registration_endpoint` - for Dynamic Client Registration (DCR)

### 3. OpenID Connect Discovery (Fallback)

**Endpoint**: `https://todo.mdx.do/.well-known/openid-configuration`

OpenID Connect compatible metadata for clients that expect OIDC.

### 4. WWW-Authenticate Headers on 401/403

All `/mcp` endpoints return proper WWW-Authenticate headers when unauthorized:

```
WWW-Authenticate: Bearer realm="https://todo.mdx.do",
                  resource_metadata="https://todo.mdx.do/.well-known/oauth-protected-resource"
```

This helps ChatGPT discover the OAuth configuration automatically.

### 5. CORS Headers

All discovery endpoints include proper CORS headers for browser-based clients:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Cache-Control: public, max-age=3600
```

## OAuth 2.1 Flow

1. **Discovery**: ChatGPT fetches `/.well-known/oauth-protected-resource`
2. **Registration**: ChatGPT registers via DCR at `/register` (obtains `client_id`)
3. **Authorization**: User redirects to `/authorize` with PKCE challenge
4. **Authentication**: User authenticates via WorkOS AuthKit
5. **Token Exchange**: ChatGPT exchanges code for token at `/token` with PKCE verifier
6. **API Access**: ChatGPT includes token in `Authorization: Bearer <token>` header

## MCP Tools Available

Once authenticated, ChatGPT can use these tools:

- `search` - Hybrid keyword + vector search across all issues
- `list` - List issues with filters (status, priority, type)
- `ready` - Get issues ready to work (no blockers)
- `blocked` - Get blocked issues
- `fetch` - Get full issue details
- `roadmap` - Generate roadmap markdown
- `create_issue` - Create new issue
- `update_issue` - Update existing issue
- `close_issue` - Close issue
- `add_dependency` - Add blocking dependency
- `remove_dependency` - Remove dependency
- `do` - Execute sandboxed JavaScript with full API access

## Security Features

- **PKCE (S256)**: Prevents authorization code interception
- **Dynamic Client Registration**: Fresh `client_id` per connection
- **Scope-based Access Control**: Fine-grained permissions
- **WorkOS AuthKit**: Enterprise-grade identity provider
- **Secure Session Binding**: State tokens bound to user sessions

## Testing ChatGPT Integration

1. Go to ChatGPT Settings → Connectors
2. Click "Add Connector"
3. Enter MCP server URL: `https://todo.mdx.do/mcp`
4. ChatGPT will auto-discover OAuth endpoints
5. Follow OAuth flow to authenticate
6. Tools will appear in ChatGPT

## Debugging

Test endpoints manually:

```bash
# Test protected resource metadata
curl https://todo.mdx.do/.well-known/oauth-protected-resource

# Test authorization server metadata
curl https://todo.mdx.do/.well-known/oauth-authorization-server

# Test OIDC discovery
curl https://todo.mdx.do/.well-known/openid-configuration

# Test 401 response with WWW-Authenticate
curl -i https://todo.mdx.do/mcp/tools
```

## References

- [RFC 8414 - OAuth 2.0 Authorization Server Metadata](https://www.rfc-editor.org/rfc/rfc8414)
- [RFC 9728 - OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728)
- [RFC 7591 - Dynamic Client Registration](https://www.rfc-editor.org/rfc/rfc7591)
- [RFC 7636 - PKCE](https://www.rfc-editor.org/rfc/rfc7636)
- [MCP Authorization Spec](https://modelcontextprotocol.io/specification/draft/basic/authorization)

## Implementation Files

- `worker/src/index.ts` - Discovery endpoints and WWW-Authenticate headers
- `worker/src/mcp/index.ts` - MCP server and tool implementations
- `worker/src/mcp/authkit-handler.ts` - OAuth flow handler with WorkOS
