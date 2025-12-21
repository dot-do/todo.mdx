# Browser Endpoint Design

## Overview

Add `/browser/:session?` endpoint to the worker that provides browser automation sessions using Browser Base (paid, full-featured) or Cloudflare Browser Rendering (free, basic).

## Routes

### Widget Pages (serve browse.html)

| Route | Description |
|-------|-------------|
| `GET /browse` | Create session, redirect to `/browse/:sessionId` |
| `GET /browse/:sessionId` | Serve browse.html (fetches API for data) |
| `GET /:org/:repo/:issue/browse` | Issue-scoped, redirect to `/browse/:sessionId` |

### API Endpoints

| Route | Description |
|-------|-------------|
| `POST /api/browser/start` | Create standalone session |
| `POST /api/browser/:org/:repo/:issue/start` | Create/get issue-scoped session |
| `GET /api/browser/:sessionId` | Session status + recording |
| `GET /api/browser/:org/:repo/:issue` | Get issue-scoped session (or 404) |
| `POST /api/browser/:sessionId/release` | Release session |
| `DELETE /api/browser/:sessionId` | Clean up from KV |

### Session IDs

- Standalone: `browser:${uuid}`
- Issue-scoped: `browser:${org}/${repo}#${issue}`

## Provider Abstraction

```typescript
// worker/src/browser/provider.ts

interface BrowserProvider {
  createSession(options: CreateSessionOptions): Promise<BrowserSession>
  getSession(sessionId: string): Promise<BrowserSession | null>
  releaseSession(sessionId: string): Promise<void>
  getRecording(sessionId: string): Promise<RrwebEvent[] | null>  // Browser Base only
}

interface BrowserSession {
  id: string
  provider: 'cloudflare' | 'browserbase'
  status: 'running' | 'completed' | 'error' | 'timed_out'
  connectUrl?: string          // WebSocket/CDP URL
  debuggerUrl?: string         // Embeddable viewer (Browser Base only)
  createdAt: number
  expiresAt?: number
}

interface CreateSessionOptions {
  timeout?: number             // Default: 60 seconds
  keepAlive?: boolean          // Browser Base only, default: true
  provider?: 'cloudflare' | 'browserbase'  // Override
  contextId?: string           // Issue ID for scoping
  userMetadata?: Record<string, string>
}
```

### Provider Selection Logic

```typescript
function selectProvider(env: Env, options: CreateSessionOptions, user?: User): 'cloudflare' | 'browserbase' {
  // Explicit override
  if (options.provider) return options.provider

  // Billing check - Browser Base requires paid tier
  if (!user?.isPaid && options.provider === 'browserbase') return 'cloudflare'

  // Env default
  return env.BROWSER_PROVIDER || 'cloudflare'
}
```

Priority: billing tier → task config → env default → cloudflare fallback

## Provider Comparison

| Feature | Cloudflare Browser Rendering | Browser Base |
|---------|------------------------------|--------------|
| Cost | Free (included) | Paid |
| Persistent sessions | No (ephemeral) | Yes (keepAlive, 6hr max) |
| Recording/replay | No | Yes (rrweb) |
| Live debug view | No | Yes |
| Use case | Quick automation, screenshots | Agent workflows, debugging |

## HTML Widget (browse.html)

Minimal HTML that works as iframe embed:

- Fetches session status from `/api/browser/:sessionId`
- If RUNNING + Browser Base → embed `debuggerUrl` in iframe
- If RUNNING + Cloudflare → show "Session active, no live view available"
- If COMPLETED → render rrweb-player with recording
- If ERROR/TIMED_OUT → show status message
- Polls for status updates

Dependencies:
- rrweb-player (CDN): `https://cdn.jsdelivr.net/npm/rrweb-player@latest/dist/index.js`

## Environment Configuration

### New Env Bindings

```typescript
// worker/src/types/env.ts

// Browser Base (optional - enables premium provider)
BROWSER_BASE_PROJECT_ID?: string
BROWSER_BASE_API_KEY?: string

// Cloudflare Browser Rendering
BROWSER?: Fetcher  // Browser Rendering binding

// Default provider selection
BROWSER_PROVIDER?: 'cloudflare' | 'browserbase'  // Default: 'cloudflare'
```

### Wrangler Config

```jsonc
// worker/wrangler.jsonc
{
  "browser": {
    "binding": "BROWSER"
  }
}
```

## KV Storage

Using existing `OAUTH_KV` namespace:

```typescript
Key: `browser:${sessionId}`
Value: {
  sessionId: string
  provider: 'cloudflare' | 'browserbase'
  providerSessionId: string      // Browser Base's internal ID
  status: 'pending' | 'running' | 'completed' | 'error' | 'timed_out'
  debuggerUrl?: string           // Browser Base only
  connectUrl?: string
  contextId?: string             // e.g., "org/repo#123" for issue-scoped
  createdAt: number
  expiresAt: number
  userId?: string                // For billing/access control
}
TTL: 24 hours (recordings available after session ends)
```

## Session Lifecycle

### Timeout Behavior

- Default: 60 seconds (agents rarely idle, cost-conscious)
- Browser Base: timeout + keepAlive=true (reconnectable until timeout)
- Cloudflare: ephemeral, no persistence

### Issue-Scoped Session Logic

```typescript
POST /api/browser/:org/:repo/:issue/start
  1. Check KV for existing session: `browser:${org}/${repo}#${issue}`
  2. If exists AND status=running → return existing session (reconnect)
  3. If exists AND status=completed → return existing (has recording)
  4. If not exists OR expired → create new session, store in KV
```

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Session timeout while viewing | Widget polls, shows "Session ended" + recording if available |
| Browser Base API error | Fall back to Cloudflare if configured, else return error |
| No recording (Cloudflare) | Widget shows "No recording available" message |
| Issue closed with active session | Session continues until timeout (no auto-release on close) |
| User not authorized for repo | 403 on issue-scoped routes |

### Status Transitions

```
pending → running → completed
                  → timed_out
                  → error
```

## File Structure

```
worker/src/
├── browser/
│   ├── index.ts              # Hono router for /api/browser/*
│   ├── provider.ts           # BrowserProvider interface + factory
│   ├── browserbase.ts        # Browser Base implementation
│   └── cloudflare.ts         # Cloudflare Browser Rendering implementation
├── types/
│   └── browser.ts            # BrowserSession, CreateSessionOptions types
└── index.ts                  # Add routes: /browse/*, /:org/:repo/:issue/browse

worker/public/
└── browse.html               # Embeddable widget (served via ASSETS)
```

## Browser Base API Reference

- Create session: `POST https://api.browserbase.com/v1/sessions`
- Get session: `GET https://api.browserbase.com/v1/sessions/{id}`
- Get recording: `GET https://api.browserbase.com/v1/sessions/{id}/recording`
- Get debug URLs: `GET https://api.browserbase.com/v1/sessions/{id}/debug`
- Auth header: `X-BB-API-Key`

Sources:
- [Long Running Sessions Guide](https://docs.browserbase.com/guides/long-running-sessions)
- [Session API Reference](https://docs.browserbase.com/reference/api/session)
- [Create Session API](https://docs.browserbase.com/reference/api/create-a-session)
- [Session Recording API](https://docs.browserbase.com/reference/api/session-recording)
