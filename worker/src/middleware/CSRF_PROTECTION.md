# CSRF Protection Implementation

This document describes the CSRF (Cross-Site Request Forgery) protection implemented across the todo.mdx application.

## Overview

CSRF protection uses a defense-in-depth approach with multiple layers:

1. **SameSite Cookies** - All session cookies use `SameSite=Lax` attribute
2. **Origin/Referer Validation** - State-changing requests must come from trusted origins
3. **CSRF Token Validation** - Double-submit cookie pattern for browser-initiated requests

## Architecture

### Worker (Cloudflare Worker)

The worker implements CSRF protection through middleware in `/worker/src/middleware/csrf.ts`:

- **`csrfProtection(allowedOrigins)`** - Validates CSRF tokens and origin headers for state-changing requests
- **`ensureCsrfToken`** - Generates and sets CSRF token cookies for authenticated pages

#### Protected Routes

CSRF protection is applied to:
- All `/api/*` routes (except webhooks which use signature verification)
- Widget pages (`/terminal`, `/code/:org/:repo`)
- Any custom API routes that use cookie-based authentication

#### Exemptions

The following are exempt from CSRF token checks:
- **GET/HEAD/OPTIONS requests** - Read-only operations
- **Token-based auth** - API keys, OAuth tokens (not browser cookie-based)
- **Webhook endpoints** - Use HMAC signature verification instead

### Payload CMS (apps/admin)

Payload CMS has built-in CSRF protection configured in `payload.config.ts`:

```typescript
{
  serverURL: 'https://admin.todo.mdx.do',
  csrf: [
    'https://todo.mdx.do',
    'https://priya.do',
    'https://admin.todo.mdx.do',
    'http://localhost:3000',
    // ... other trusted domains
  ],
  cors: [
    // Same list as csrf
  ]
}
```

Payload automatically handles CSRF token validation for cookie-based authentication.

## How It Works

### 1. Session Creation

When a user logs in via `/api/auth/callback`:
1. Session cookie is created with `SameSite=Lax`
2. CSRF token is generated and set as a separate cookie (`__Host-CSRF-TOKEN`)
3. Both cookies are HTTP-only and Secure

### 2. Making State-Changing Requests

For browser-based requests using cookie authentication:

```javascript
// Fetch the CSRF token from cookie
const csrfToken = getCsrfTokenFromCookie()

// Include it in the request header
fetch('/api/repos/owner/repo/sync', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken,
    'Content-Type': 'application/json'
  },
  credentials: 'include' // Include cookies
})
```

### 3. Validation Flow

```
Request → Rate Limit → Auth Middleware → CSRF Protection → Route Handler
                ↓            ↓                    ↓
            Check IP    Validate Session    Validate Origin & Token
```

**CSRF Protection checks:**
1. Is this a safe method (GET/HEAD/OPTIONS)? → Allow
2. Is this token-based auth (not cookie)? → Allow (skip CSRF)
3. Does Origin/Referer header match allowed list? → Reject if not
4. Does CSRF token in cookie match token in header? → Reject if not
5. All checks passed → Allow request

## Configuration

### Allowed Origins

Defined in `/worker/src/index.ts`:

```typescript
const ALLOWED_ORIGINS = [
  'https://todo.mdx.do',
  'https://priya.do',
  'http://localhost:3000',
  'http://localhost', // Allows any localhost port for dev
]
```

These origins are used for:
- CORS configuration
- CSRF origin validation
- Payload CMS CSRF whitelist

## Security Considerations

### Why SameSite=Lax?

- **SameSite=Lax** provides CSRF protection for state-changing requests (POST/PUT/DELETE)
- Still allows cookies on top-level navigation (e.g., clicking links)
- **SameSite=Strict** would be too restrictive for this use case

### Why Double-Submit Cookie Pattern?

- CSRF token stored in cookie (HTTP-only)
- Same token must be sent in request header
- Attacker cannot read cookies from other domains due to Same-Origin Policy
- Even if they trigger a request, they cannot set the required header

### Why Exempt Token-Based Auth?

- API keys and OAuth tokens are not cookie-based
- They must be explicitly included in requests (not sent automatically)
- CSRF attacks rely on automatic cookie inclusion
- Token-based auth is immune to CSRF by design

## Testing

### Manual Testing

1. **Valid request:**
```bash
# Get CSRF token from login
curl -c cookies.txt https://api.todo.mdx.do/api/auth/login

# Extract CSRF token from cookies
CSRF_TOKEN=$(grep CSRF-TOKEN cookies.txt | awk '{print $7}')

# Make authenticated request with CSRF token
curl -b cookies.txt \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -X POST https://api.todo.mdx.do/api/repos/owner/repo/sync
```

2. **Invalid origin:**
```bash
# Should be rejected (wrong origin)
curl -b cookies.txt \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -H "Origin: https://evil.com" \
  -X POST https://api.todo.mdx.do/api/repos/owner/repo/sync
```

3. **Missing token:**
```bash
# Should be rejected (no CSRF token)
curl -b cookies.txt \
  -X POST https://api.todo.mdx.do/api/repos/owner/repo/sync
```

4. **Token mismatch:**
```bash
# Should be rejected (wrong token)
curl -b cookies.txt \
  -H "X-CSRF-Token: wrong-token" \
  -X POST https://api.todo.mdx.do/api/repos/owner/repo/sync
```

### Automated Testing

TODO: Add vitest tests for CSRF middleware

## References

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Payload CMS Security Documentation](https://payloadcms.com/docs/authentication/cookies)
- [MDN: SameSite cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
