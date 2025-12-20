# MCP OAuth 2.1 with WorkOS AuthKit

This directory implements the Model Context Protocol (MCP) server with OAuth 2.1 authorization using WorkOS AuthKit for user authentication.

## OAuth Flow

### 1. Authorization Request

MCP client initiates OAuth flow by calling `/mcp/authorize` with:

```
GET /mcp/authorize?
  client_id=<client_id>&
  redirect_uri=<client_redirect_uri>&
  response_type=code&
  state=<client_state>&
  code_challenge=<pkce_challenge>&
  code_challenge_method=S256&
  scope=mcp:read
```

**Server actions:**
- Validates PKCE parameters (required for OAuth 2.1)
- Stores OAuth parameters in D1 (`mcp_oauth_state` table)
- Redirects to WorkOS AuthKit for user authentication

### 2. WorkOS Authentication

User is redirected to WorkOS AuthKit domain where they:
- Sign in with email/password or SSO
- Grant permissions to the MCP client

### 3. Callback

WorkOS redirects to `/mcp/callback` with:

```
GET /mcp/callback?
  code=<workos_code>&
  state=<state_id>
```

**Server actions:**
- Retrieves OAuth state from D1 using `state_id`
- Exchanges WorkOS `code` for user information
- Creates or updates user in Payload CMS
- Generates MCP authorization code
- Redirects to client's `redirect_uri` with authorization code

### 4. Token Exchange

Client exchanges authorization code for access token:

```
POST /mcp/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=<authorization_code>&
redirect_uri=<client_redirect_uri>&
code_verifier=<pkce_verifier>&
client_id=<client_id>
```

**Server actions:**
- Validates authorization code
- Verifies PKCE code verifier matches challenge
- Issues access token (stored in D1)
- Returns token response

### 5. API Access

Client uses access token to call MCP endpoints:

```
GET /mcp/tools
Authorization: Bearer <access_token>
```

## Database Tables

### `mcp_oauth_state`

Temporary storage for OAuth parameters during WorkOS authentication:

- `state_id` - Unique identifier for this OAuth flow
- `client_id` - MCP client identifier
- `redirect_uri` - Client's callback URL
- `scope` - Requested permissions
- `client_state` - Client's state parameter (for CSRF)
- `code_challenge` - PKCE challenge
- `code_challenge_method` - Always "S256"
- `expires_at` - Expiration timestamp (10 minutes)

### `mcp_auth_codes`

Short-lived authorization codes (10 minutes):

- `code` - Authorization code
- `user_id` - WorkOS user ID
- `client_id` - MCP client identifier
- `redirect_uri` - Client's callback URL
- `code_challenge` - PKCE challenge
- `scope` - Granted permissions
- `expires_at` - Expiration timestamp

### `mcp_access_tokens`

Long-lived access tokens (1 hour):

- `token` - Access token
- `user_id` - WorkOS user ID
- `client_id` - MCP client identifier
- `scope` - Granted permissions
- `expires_at` - Expiration timestamp

## Environment Variables

Required secrets (set via `wrangler secret put`):

- `WORKOS_API_KEY` - WorkOS API key
- `WORKOS_CLIENT_ID` - WorkOS client ID
- `WORKOS_CLIENT_SECRET` - WorkOS client secret

## Configuration

### WorkOS Dashboard

1. Add redirect URI in WorkOS Dashboard:
   - Local: `http://localhost:8787/mcp/callback`
   - Production: `https://your-worker.workers.dev/mcp/callback`

2. Enable AuthKit for your application

### MCP Client

Configure MCP client to use this OAuth server:

```json
{
  "authorization_endpoint": "https://your-worker.workers.dev/mcp/authorize",
  "token_endpoint": "https://your-worker.workers.dev/mcp/token"
}
```

## Security Features

- **PKCE Required**: OAuth 2.1 requires PKCE (S256) for all flows
- **State Validation**: Prevents CSRF attacks
- **Short Expiration**: Auth codes expire in 10 minutes
- **Token Cleanup**: Expired tokens automatically cleaned up
- **User Isolation**: Tokens scoped to specific users

## Cleanup

Periodically call the cleanup endpoint to remove expired tokens:

```bash
curl -X POST https://your-worker.workers.dev/mcp/cleanup
```

Returns:
```json
{
  "message": "Cleanup complete",
  "deleted": {
    "authCodes": 5,
    "accessTokens": 12,
    "oauthState": 3
  }
}
```

## Reference

- [OAuth 2.1 Specification](https://oauth.net/2.1/)
- [WorkOS AuthKit Documentation](https://workos.com/docs/authkit)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [PKCE (RFC 7636)](https://tools.ietf.org/html/rfc7636)
