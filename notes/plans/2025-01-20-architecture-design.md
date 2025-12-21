# todo.mdx Architecture Design

## Overview

A bidirectional sync system between markdown files, beads issues, GitHub Issues, and a cloud Durable Object. Includes both local (stdio) and cloud (HTTP) MCP servers for AI integration.

## Two-Tier Architecture

### Local (CLI)

- **beads** is the core dependency managing `.beads/issues.jsonl` and `.beads/events.jsonl`
- **todo.mdx** renders beads data to markdown and extracts changes back
- **roadmap.mdx** extends todo.mdx with milestone/epic support
- **stdio MCP server** for local AI tools (Claude Code, Cursor, etc.)
- File system is source of truth locally

### Cloud (GitHub App + MCP)

- **todo.mdx GitHub App** receives webhooks
- **Cloudflare Worker** routes webhooks to Durable Objects
- **RepoDO** with XState machine coordinates sync
- **HTTP MCP server** with OAuth 2.1 for remote AI (ChatGPT, Claude web, etc.)
- DO is source of truth for cloud/API layer

## Complete Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LOCAL (CLI)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐     ┌──────────────────────────────────────────────┐  │
│  │  Claude Code /   │     │                beads                          │  │
│  │  Cursor / etc.   │────▶│  .beads/issues.jsonl  (source of truth)       │  │
│  │                  │     │  .beads/events.jsonl                          │  │
│  └────────┬─────────┘     └────────────────┬─────────────────────────────┘  │
│           │                                │                                 │
│           ▼                                ▼                                 │
│  ┌──────────────────┐     ┌──────────────────────────────────────────────┐  │
│  │   stdio MCP      │     │         todo.mdx / roadmap.mdx                │  │
│  │   (todo.mdx)     │────▶│  Renders beads ↔ markdown bidirectionally    │  │
│  │                  │     │                                               │  │
│  └──────────────────┘     └────────────────┬─────────────────────────────┘  │
│                                            │                                 │
│                                            ▼                                 │
│                           ┌──────────────────────────────────────────────┐  │
│                           │           Generated Files                     │  │
│                           │  TODO.md      (GFM index with links)         │  │
│                           │  .todo/*.md   (issue details)                │  │
│                           │  ROADMAP.md   (milestone progress)           │  │
│                           │  .roadmap/*.md (milestone details)           │  │
│                           └────────────────┬─────────────────────────────┘  │
│                                            │                                 │
│                                            ▼                                 │
│                                      git commit & push                       │
└─────────────────────────────────────────────┬───────────────────────────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLOUD (GitHub App)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐                                                        │
│  │  GitHub Webhooks │─────┐                                                  │
│  │  (push, issues)  │     │                                                  │
│  └──────────────────┘     │                                                  │
│                           ▼                                                  │
│  ┌──────────────────┐     ┌──────────────────────────────────────────────┐  │
│  │  Local SDK       │────▶│         Cloudflare Worker                     │  │
│  │  (online mode)   │     │                                               │  │
│  └──────────────────┘     │  /webhook/github - route to DO               │  │
│                           │  /api/*          - REST API (for SDK)        │  │
│  ┌──────────────────┐     │  /mcp/*          - HTTP MCP (for AI)         │  │
│  │  ChatGPT /       │────▶│                                               │  │
│  │  Claude Web      │     └────────────────┬─────────────────────────────┘  │
│  └──────────────────┘                      │                                 │
│                                            ▼                                 │
│                           ┌──────────────────────────────────────────────┐  │
│                           │         RepoDO (per repo)                     │  │
│                           │  XState machine for sync coordination        │  │
│                           │  SQLite for issues/milestones                │  │
│                           │  Source of truth for cloud                   │  │
│                           └────────────────┬─────────────────────────────┘  │
│                                            │                                 │
│                                            ▼                                 │
│                           ┌──────────────────────────────────────────────┐  │
│                           │              Sync Targets                     │  │
│                           │  ┌────────────┐  ┌────────────┐              │  │
│                           │  │ GitHub     │  │ Repo Files │              │  │
│                           │  │ Issues API │  │ via Git    │              │  │
│                           │  └────────────┘  └────────────┘              │  │
│                           └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## File Structure

```
TODO.md                    # Generated index with GFM links (human-readable)
ROADMAP.md                 # Generated roadmap with progress (human-readable)
.todo/
  beads-001.md            # Full issue details (editable)
  beads-002.md
.roadmap/
  milestone-001.md        # Milestone details
  epic-001.md             # Epic details
.beads/
  issues.jsonl            # Source of truth (beads)
  events.jsonl            # Event log
```

## TODO.md Format

Generated index with clickable links:

```markdown
# TODO

## In Progress
- [ ] [Add user authentication](https://github.com/org/repo/issues/42) ([details](.todo/beads-042.md))
- [ ] [Fix login redirect](.todo/beads-043.md)

## Ready
- [ ] [Implement dark mode](https://github.com/org/repo/issues/44) ([details](.todo/beads-044.md))

## Blocked
- [ ] [Deploy to production](.todo/beads-045.md) - blocked by beads-042, beads-044
```

## Package Relationships

```
beads (core issue management)
  ↑
todo.mdx (markdown rendering/extraction + stdio MCP)
  ↑
roadmap.mdx (milestones/epics extension)
```

### todo.mdx package.json

```json
{
  "dependencies": {
    "beads": "^1.0.0",
    "@mdxld/markdown": "^1.9.0",
    "@mdxld/extract": "^1.9.0"
  }
}
```

### roadmap.mdx Composition

```typescript
import { createTodoServer, todoTools } from 'todo.mdx/mcp'

export function createRoadmapServer(options) {
  const server = createTodoServer(options)

  // Add milestone/epic tools
  server.addTool('milestone_list', milestoneListTool)
  server.addTool('epic_list', epicListTool)

  return server
}
```

## Sync Flow

### Push Event (repo → cloud)

```
git push
    ↓
GitHub webhook (push event)
    ↓
todo.mdx GitHub App
    ↓
Cloudflare Worker
    ↓
RepoDO (XState machine)
    ↓
1. Fetch .beads/issues.jsonl
2. Diff with DO state
3. Create/update GitHub Issues
4. Update DO state
5. Commit back if needed
```

### Issue Event (GitHub → repo)

```
GitHub Issue created/edited/closed
    ↓
GitHub webhook (issues event)
    ↓
todo.mdx GitHub App
    ↓
RepoDO (XState machine)
    ↓
1. Update DO state
2. Update .beads/issues.jsonl
3. Regenerate TODO.md
4. Regenerate .todo/*.md
5. Commit to repo
```

## XState Machine

States for reliable sync coordination:

```
idle
  ├→ fetchingRepo (on PUSH_RECEIVED)
  ├→ syncingFromGitHub (on ISSUE_* events)

fetchingRepo
  └→ diffing

diffing
  ├→ syncingToGitHub (if changes)
  └→ idle (no changes)

syncingToGitHub
  └→ committingBack

syncingFromGitHub
  └→ regeneratingFiles

regeneratingFiles
  └→ committingBack

committingBack
  └→ idle

retrying (on any error)
  ├→ fetchingRepo (can retry)
  └→ failed (max retries exceeded)

failed
  └→ idle (on RETRY)
```

### Features

- Queues concurrent webhooks
- Exponential backoff retries
- Persists state to DO storage
- Clear state for debugging

## Implementation Files

### Worker (based on remote-mcp-authkit template)

Uses [cloudflare/ai/demos/remote-mcp-authkit](https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-authkit) as base:

```
worker/
├── public/                    # Static assets (dashboard)
│   ├── index.html
│   ├── api-keys.html
│   ├── repos.html
│   └── assets/
├── src/
│   ├── index.ts              # Hono app entry
│   ├── auth/
│   │   ├── middleware.ts     # Token validation (WorkOS + jose)
│   │   ├── jwt.ts            # OAuth JWT verification
│   │   └── workos.ts         # WorkOS API key verification
│   ├── api/
│   │   ├── index.ts          # REST API router
│   │   ├── issues.ts         # Issues CRUD
│   │   ├── milestones.ts     # Milestones CRUD
│   │   ├── repos.ts          # Repo management
│   │   └── widget.ts         # WorkOS widget token
│   ├── mcp/
│   │   ├── index.ts          # MCP protocol handler
│   │   ├── tools.ts          # MCP tools
│   │   └── resources.ts      # MCP resources
│   ├── webhook/
│   │   └── github.ts         # GitHub webhook handler
│   └── do/
│       ├── repo.ts           # RepoDO class
│       ├── repo-machine.ts   # XState machine
│       └── repo-services.ts  # Machine services
├── wrangler.toml
└── package.json
```

**Template features we use:**
- WorkOS AuthKit integration
- KV storage for OAuth state
- Cookie-based sessions
- Permission gating for tools
- Static assets serving

### Packages

```
packages/todo.mdx/src/
├── mcp/
│   ├── server.ts         # stdio MCP server
│   ├── tools.ts          # MCP tools
│   └── resources.ts      # MCP resources
├── generate.ts           # TODO.md generation
├── render.ts             # beads → .todo/*.md
└── extract.ts            # .todo/*.md → beads

packages/roadmap.mdx/src/
├── mcp/
│   ├── server.ts         # Extends todo.mdx server
│   └── tools.ts          # Milestone/epic tools
├── generate.ts           # ROADMAP.md generation
└── render.ts             # Milestone/epic rendering
```

## REST API

The worker exposes a REST API that the local SDK uses:

```
worker/src/api/
├── index.ts          # Hono router
├── issues.ts         # CRUD for issues
├── milestones.ts     # CRUD for milestones
├── sync.ts           # Sync endpoints
└── repos.ts          # Repo management
```

**Endpoints:**
```
GET    /api/repos                    # List user's repos
GET    /api/repos/:owner/:repo       # Get repo info

GET    /api/repos/:owner/:repo/issues          # List issues
POST   /api/repos/:owner/:repo/issues          # Create issue
GET    /api/repos/:owner/:repo/issues/:id      # Get issue
PATCH  /api/repos/:owner/:repo/issues/:id      # Update issue
DELETE /api/repos/:owner/:repo/issues/:id      # Delete issue

GET    /api/repos/:owner/:repo/milestones      # List milestones
POST   /api/repos/:owner/:repo/milestones      # Create milestone
GET    /api/repos/:owner/:repo/milestones/:id  # Get milestone
PATCH  /api/repos/:owner/:repo/milestones/:id  # Update milestone

POST   /api/repos/:owner/:repo/sync            # Trigger sync
GET    /api/repos/:owner/:repo/sync/status     # Sync status
```

**Authentication:**
- Bearer token (OAuth via oauth.do or WorkOS API key)
- GitHub App installation token for webhooks only

## Authentication Architecture

Separated concerns for auth:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Authentication Sources                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  oauth.do    │  │   WorkOS     │  │    GitHub App        │   │
│  │              │  │              │  │                      │   │
│  │  CLI OAuth   │  │  API Keys    │  │  Webhooks Only       │   │
│  │  ensureLogin │  │  Programmatic│  │  (not user auth)     │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                 │                      │               │
│         ▼                 ▼                      ▼               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Cloudflare Worker                       │   │
│  │                                                           │   │
│  │  /api/*  - REST API (OAuth token or API key)             │   │
│  │  /mcp/*  - MCP (OAuth token or API key)                  │   │
│  │  /webhook/github - Installation token                    │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### oauth.do (CLI OAuth)

For interactive CLI usage:

```typescript
// packages/todo.mdx/src/cli.ts
import { ensureLoggedIn } from 'oauth.do/node'

const auth = await ensureLoggedIn({
  clientId: 'todo-mdx',
  scopes: ['repos:read', 'repos:write'],
})

// auth.accessToken is now available for API calls
const client = createClient({
  repo: 'owner/repo',
  token: auth.accessToken,
})
```

### WorkOS (API Keys)

For programmatic/CI usage:

```typescript
// Environment variable
TODOMDX_API_KEY=sk_live_xxx

// SDK detects API key
const client = createClient({
  repo: 'owner/repo',
  apiKey: process.env.TODOMDX_API_KEY,
})
```

### Web Developer Dashboard

Minimal static dashboard using [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/):

```
worker/
├── public/                    # Static assets (served by CF)
│   ├── index.html            # Dashboard home
│   ├── dashboard.html        # Main dashboard
│   ├── api-keys.html         # API keys (WorkOS widget)
│   ├── repos.html            # Connected repos
│   └── assets/
│       ├── app.js            # Vanilla JS dashboard
│       └── style.css         # Minimal styles
├── wrangler.toml             # assets = { directory = "public" }
└── src/
    └── index.ts              # API routes + static fallback
```

**wrangler.toml:**
```toml
[assets]
directory = "public"
```

**Dashboard pages:**

```html
<!-- public/api-keys.html -->
<!DOCTYPE html>
<html>
<head>
  <title>API Keys - todo.mdx</title>
  <script src="https://js.workos.com/widgets.js"></script>
  <link rel="stylesheet" href="/assets/style.css">
</head>
<body>
  <nav>
    <a href="/">Dashboard</a>
    <a href="/repos.html">Repos</a>
    <a href="/api-keys.html" class="active">API Keys</a>
  </nav>
  <main>
    <h1>API Keys</h1>
    <div id="api-keys-widget"></div>
  </main>
  <script src="/assets/app.js"></script>
</body>
</html>
```

**API endpoint for widget token:**
```typescript
// worker/src/api/widget.ts
app.get('/api/widget-token', validateAuth, async (c) => {
  const workos = new WorkOS(c.env.WORKOS_API_KEY)
  const token = await workos.widgets.getToken({
    userId: c.get('userId'),
    scopes: ['widgets:api-keys:manage'],
  })
  return c.json({ token })
})
```

**Dashboard features:**
- Static HTML/CSS/JS (no build step needed)
- Login via oauth.do
- WorkOS API Keys widget for self-service
- View connected repos and sync status
- Lightweight (~10KB total)

### GitHub App (Webhooks Only)

GitHub App handles webhooks, NOT user authentication:

```typescript
// worker/src/webhook/github.ts
app.post('/webhook/github', async (c) => {
  // Verify webhook signature
  const signature = c.req.header('x-hub-signature-256')
  if (!verifyWebhookSignature(body, signature, c.env.GITHUB_WEBHOOK_SECRET)) {
    return c.json({ error: 'Invalid signature' }, 401)
  }

  // Use installation token for GitHub API calls
  const installationToken = await getInstallationToken(payload.installation.id)

  // Route to DO
  const repoDO = c.env.REPO_DO.get(doId)
  await repoDO.handleWebhook({ ...payload, installationToken })
})
```

### Token Validation Middleware

```typescript
// worker/src/auth/middleware.ts
import { WorkOS } from '@workos-inc/node'

export async function validateAuth(c, next) {
  const workos = new WorkOS(c.env.WORKOS_API_KEY)
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const token = authHeader.slice(7)

  // Check for WorkOS API key (starts with sk_live_ or sk_test_)
  if (token.startsWith('sk_live_') || token.startsWith('sk_test_')) {
    try {
      // Verify API key using WorkOS SDK
      // https://workos.com/docs/api-keys/verify
      const { data: apiKey } = await workos.apiKeys.verify({
        token,
      })

      c.set('userId', apiKey.userId)
      c.set('orgId', apiKey.organizationId)
      c.set('authType', 'api_key')
      c.set('keyName', apiKey.name)
      return next()
    } catch (error) {
      return c.json({ error: 'invalid_api_key' }, 401)
    }
  }

  // Otherwise treat as OAuth token from oauth.do
  try {
    const session = await validateOAuthToken(token, c.env)
    c.set('userId', session.userId)
    c.set('authType', 'oauth')
    return next()
  } catch (error) {
    return c.json({ error: 'invalid_token' }, 401)
  }
}
```

**WorkOS API Key features:**
- Keys created via dashboard widget
- Scoped permissions (read, write, admin)
- Automatic rotation support
- Usage tracking and audit logs

### OAuth Token Verification (jose)

For oauth.do tokens (JWTs), use jose for verification:

```typescript
// worker/src/auth/jwt.ts
import { jwtVerify, createRemoteJWKSet } from 'jose'

// Cache the JWKS
const JWKS = createRemoteJWKSet(
  new URL('https://oauth.do/.well-known/jwks.json')
)

export async function validateOAuthToken(token: string, env: Env) {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: 'https://oauth.do',
      audience: 'todo-mdx',
    })

    return {
      userId: payload.sub,
      email: payload.email,
      scopes: payload.scope?.split(' ') || [],
    }
  } catch (error) {
    throw new Error('Invalid OAuth token')
  }
}
```

**JWT verification features:**
- JWKS auto-discovery and caching
- Issuer and audience validation
- Expiry checking built-in
- Edge-compatible (works in Workers)

## Local SDK

The todo.mdx package provides an SDK that uses the REST API when online:

```typescript
// packages/todo.mdx/src/sdk/index.ts
import { Beads } from 'beads'

export interface TodoClient {
  issues: IssueAPI
  milestones: MilestoneAPI
  sync: () => Promise<void>
}

export function createClient(options: {
  repo: string
  token?: string        // Optional: use REST API
  offline?: boolean     // Force offline mode
}): TodoClient {

  if (options.token && !options.offline) {
    // Online mode: use REST API
    return createRestClient(options)
  }

  // Offline mode: use local beads
  return createLocalClient(options)
}

// REST client - calls worker API
function createRestClient(options): TodoClient {
  const baseUrl = 'https://todo.mdx.do/api'

  return {
    issues: {
      list: () => fetch(`${baseUrl}/repos/${options.repo}/issues`, {
        headers: { Authorization: `Bearer ${options.token}` }
      }).then(r => r.json()),

      create: (data) => fetch(`${baseUrl}/repos/${options.repo}/issues`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      }).then(r => r.json()),

      // ... other methods
    },
    // ... milestones, sync
  }
}

// Local client - uses beads directly
function createLocalClient(options): TodoClient {
  const beads = Beads({ cwd: process.cwd() })

  return {
    issues: {
      list: () => beads.issues.list(),
      create: (data) => beads.issues.create(data),
      // ... maps to beads API
    },
    // ...
  }
}
```

**Hybrid Mode:**
- SDK checks connectivity on init
- Falls back to local beads if offline
- Queues mutations for sync when back online

## MCP Servers

### stdio MCP (Local CLI)

For local AI tools like Claude Code, Cursor, Windsurf:

```
packages/todo.mdx/src/mcp/
├── server.ts         # stdio MCP server entry
├── tools.ts          # todo_list, todo_show, todo_create, etc.
└── resources.ts      # todo://issues, todo://stats
```

**Tools (camelCase to match SDK):**
- `listIssues` - List issues (status filter)
- `getIssue` - Get issue details
- `createIssue` - Create new issue
- `updateIssue` - Update issue
- `closeIssue` - Close issue
- `listReady` - List ready (unblocked) issues
- `listMilestones` - List milestones
- `getMilestone` - Get milestone details

**Resources:**
- `todo://issues` - All issues
- `todo://stats` - Progress statistics
- `todo://blocked` - Blocked issues

### HTTP MCP (Cloud)

For remote AI tools like ChatGPT, Claude web:

```
worker/src/mcp/index.ts  # Already implemented
```

**OAuth 2.1 with PKCE:**
- `/.well-known/oauth-authorization-server` - RFC 8414 metadata
- `/mcp/authorize` - Authorization endpoint
- `/mcp/token` - Token endpoint
- `/mcp/revoke` - Token revocation

**ChatGPT Deep Research Compatible:**
- `search` - Returns `[{id, title, url}, ...]`
- `fetch` - Returns `{id, title, text, url, metadata}`
- `roadmap` - Full roadmap rendered with @mdxld/markdown

**Additional Tools (camelCase to match SDK):**
- `listIssues` - List issues from repo
- `createIssue` - Create issue
- `updateIssue` - Update issue
- `listMilestones` - List milestones
- `do` - Execute JS with pre-loaded data (repos, issues, milestones)

## Key Decisions

1. **beads as core** - Don't duplicate issue management
2. **TODO.md for visibility** - Generated index with GFM links
3. **GitHub App for webhooks only** - Not for user authentication
4. **oauth.do for CLI auth** - Secure browser-based OAuth via `ensureLoggedIn`
5. **WorkOS for API keys** - Programmatic/CI access via `sk_live_xxx` keys
6. **XState for reliability** - State machine prevents race conditions
7. **DO as cloud truth** - Consistent state for API layer
8. **Dual MCP servers** - stdio for local, HTTP+OAuth for cloud
9. **REST API** - Worker exposes REST endpoints for SDK
10. **SDK online/offline** - Uses REST API when online, beads locally when offline
11. **camelCase consistency** - MCP tools match SDK function names
