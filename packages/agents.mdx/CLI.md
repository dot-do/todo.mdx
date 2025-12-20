# agents.mdx CLI

Command-line interface for authenticating and managing workflows with agents.mdx.

## Installation

```bash
# In the monorepo
pnpm install

# Build the package
cd packages/agents.mdx
pnpm build

# Link globally (optional)
pnpm link --global
```

## Usage

### Authentication

Authenticate via oauth.do to receive tokens for Claude Code, GitHub, and WorkOS:

```bash
agents.mdx auth
```

This will:
1. Open oauth.do in your browser
2. Prompt you to authenticate
3. Store tokens securely in `~/.agents.mdx/tokens.json`

The tokens stored include:
- **Claude JWT**: Long-lived token for Claude Code CLI
- **GitHub Token**: For PRs, issues, and repository operations
- **WorkOS Token**: For vault access and secure storage

### Check Authentication Status

```bash
agents.mdx status
```

Shows:
- Whether you're authenticated
- Token expiration date
- Truncated token values (for security)

### Logout

Clear stored credentials:

```bash
agents.mdx logout
```

### Help

```bash
agents.mdx help
```

## Token Storage

Tokens are stored in `~/.agents.mdx/tokens.json` with strict file permissions (0600).

The file structure:

```json
{
  "claudeJwt": "eyJ...",
  "githubToken": "ghp_...",
  "workosToken": "wos_...",
  "expiresAt": "2025-12-20T12:00:00.000Z"
}
```

## OAuth Flow Details

The auth flow uses a local HTTP server to receive the OAuth callback:

1. CLI starts a local server on a random available port
2. Opens browser to `https://oauth.do/authorize` with:
   - `client_id`: agents-mdx
   - `redirect_uri`: http://localhost:{port}/callback
   - `scope`: claude:code github:repo workos:vault
   - `response_type`: token
3. User authenticates on oauth.do
4. oauth.do redirects to localhost with tokens
5. CLI receives tokens and stores them locally
6. Server closes and CLI confirms authentication

## Security Considerations

- Tokens are stored with strict file permissions (0600) - only the owner can read/write
- Config directory is created with 0700 permissions - only owner can access
- OAuth callback server only accepts connections from localhost
- OAuth flow times out after 5 minutes
- Browser-based flow prevents token exposure in terminal/logs

## Development

To test the CLI during development:

```bash
# Build
pnpm build

# Run directly
node dist/cli.js auth

# Or use via package scripts
pnpm cli auth
```

## Future Enhancements

- [ ] Integrate with WorkOS vault for secure cloud token storage
- [ ] Add token refresh flow
- [ ] Support multiple authentication profiles
- [ ] Add encryption for local token storage
- [ ] Implement device flow for headless environments
- [ ] Add PKCE for additional OAuth security
