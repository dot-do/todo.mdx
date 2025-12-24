# GitHub Sync Worker

Cloudflare Worker for bi-directional sync between GitHub Issues and beads issue tracker.

## Architecture

```
GitHub Issues ←→ Webhook Handler ←→ db.td (Durable Objects) ←→ beads
```

The worker:
1. Receives GitHub webhook events at `/webhook`
2. Verifies HMAC-SHA256 signatures for security
3. Syncs issue changes to/from beads via db.td Durable Objects
4. Handles installation, issue, and comment events

## Prerequisites

1. **Cloudflare Account** with Workers enabled
2. **GitHub App** (see [Creating the GitHub App](#creating-the-github-app))
3. **db.td Worker** deployed (for Durable Object storage)

## Required Secrets

Set these secrets using `wrangler secret put <name>`:

| Secret | Description |
|--------|-------------|
| `GITHUB_APP_ID` | Your GitHub App's numeric ID |
| `GITHUB_PRIVATE_KEY` | PEM-format private key from GitHub App |
| `GITHUB_WEBHOOK_SECRET` | Secret configured in GitHub App webhook settings |

```bash
# Set secrets
wrangler secret put GITHUB_APP_ID --config worker/wrangler.jsonc
wrangler secret put GITHUB_PRIVATE_KEY --config worker/wrangler.jsonc
wrangler secret put GITHUB_WEBHOOK_SECRET --config worker/wrangler.jsonc
```

## Creating the GitHub App

### Option 1: Using App Manifest (Recommended)

1. Navigate to GitHub Settings > Developer settings > GitHub Apps
2. Click "New GitHub App"
3. Use the manifest at `.github/app-manifest.json` as reference

### Option 2: Manual Configuration

Create a new GitHub App with these settings:

**General:**
- Name: `todo.mdx` (or your preferred name)
- Homepage URL: `https://todo.mdx.workers.dev`
- Webhook URL: `https://todo.mdx.workers.dev/webhook`
- Webhook secret: Generate a secure random string

**Permissions:**
- Issues: Read & Write
- Metadata: Read
- Pull requests: Read & Write
- Contents: Read & Write
- Repository projects: Read & Write
- Organization projects: Read & Write (if needed)

**Subscribe to events:**
- Issues
- Issue comment
- Milestone
- Push
- Projects v2
- Projects v2 item

After creating the app:
1. Note the App ID (shown on the app's general settings page)
2. Generate a private key (scroll to bottom of settings page)
3. Download and securely store the private key

## Deployment

### Local Development

```bash
# From project root
pnpm worker:dev
```

This starts the worker locally at `http://localhost:8787`.

### Production Deployment

```bash
# From project root
pnpm worker:deploy
```

The worker deploys to: `https://todo-mdx-github-sync.<your-subdomain>.workers.dev`

### Custom Domain

To deploy to `todo.mdx.workers.dev`:

1. Add a custom domain in Cloudflare Workers dashboard
2. Or add to `wrangler.jsonc`:

```jsonc
{
  "routes": [
    { "pattern": "todo.mdx.workers.dev/*", "zone_name": "workers.dev" }
  ]
}
```

## Configuration

### wrangler.jsonc

```jsonc
{
  "name": "todo-mdx-github-sync",
  "main": "index.ts",
  "compatibility_date": "2024-12-01",
  "compatibility_flags": ["nodejs_compat"],

  // Durable Object binding for db.td
  "durable_objects": {
    "bindings": [
      {
        "name": "DB",
        "class_name": "DB",
        "script_name": "db-td"  // Your db.td worker name
      }
    ]
  }
}
```

### Self-Hosting

Consumers can self-host by re-exporting the worker:

```ts
// their-worker/index.ts
export { default } from 'todo.mdx/worker'
export { DB } from 'db.td/worker'
```

With their own `wrangler.jsonc`:

```jsonc
{
  "main": "index.ts",
  "durable_objects": {
    "bindings": [{ "name": "DB", "class_name": "DB" }]
  },
  "migrations": [{ "tag": "v1", "new_classes": ["DB"] }]
}
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check - returns `{"status": "ok"}` |
| `/webhook` | POST | GitHub webhook receiver |

## Webhook Events Handled

| Event | Actions | Description |
|-------|---------|-------------|
| `installation` | created, deleted | App installation tracking |
| `issues` | opened, edited, closed, reopened, labeled, unlabeled, assigned, unassigned | Issue sync |
| `issue_comment` | created, edited, deleted | Comment tracking |

## Troubleshooting

### Webhook Signature Failures

- Verify `GITHUB_WEBHOOK_SECRET` matches your GitHub App settings
- Check that the secret doesn't have trailing whitespace
- Ensure the payload is being verified against the raw body (not parsed JSON)

### Installation Not Found

- Verify the GitHub App is installed on the repository
- Check that the installation webhook was received and processed

### db.td Connection Issues

- Verify the `script_name` in wrangler.jsonc matches your db.td worker
- Ensure both workers are in the same Cloudflare account

## Project Structure

```
worker/
├── index.ts              # Main worker entry point
├── wrangler.jsonc        # Wrangler configuration
├── README.md             # This file
└── github-sync/
    ├── index.ts          # Module exports
    ├── webhook.ts        # Webhook signature verification
    ├── github-client.ts  # GitHub API client
    ├── entities.ts       # db.td entity types
    ├── conventions.ts    # Label/status mapping
    ├── parser.ts         # Issue body parsing
    ├── label-mapper.ts   # Label to field mapping
    ├── beads-to-github.ts   # beads -> GitHub conversion
    ├── github-to-beads.ts   # GitHub -> beads conversion
    ├── sync-orchestrator.ts # Sync coordination
    ├── cli.ts            # CLI for manual sync
    └── tests/            # Unit tests
```

## Security Considerations

- All webhook payloads are verified using HMAC-SHA256
- Constant-time comparison prevents timing attacks
- Private keys should never be committed to version control
- Webhook secrets should be high-entropy random strings

## Dependencies

- **hono** - Web framework for Cloudflare Workers
- **db.td** - Durable Object storage
- Web Crypto API (built into Workers runtime)
