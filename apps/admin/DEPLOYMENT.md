# Payload RPC Deployment Guide

This guide covers deploying the Payload RPC worker to Cloudflare Workers.

## Prerequisites

1. Cloudflare account with Workers enabled
2. D1 database created: `todo-mdx`
3. R2 bucket created: `todo-mdx-media`
4. wrangler CLI installed and authenticated

## Setup Steps

### 1. Install Dependencies

From the monorepo root:

```bash
pnpm install
```

This will install dependencies for all workspaces, including the admin app.

### 2. Configure Secrets

Set the Payload secret:

```bash
cd apps/admin
wrangler secret put PAYLOAD_SECRET
# Enter a secure random string (e.g., use `openssl rand -base64 32`)
```

### 3. Verify Configuration

Check that `wrangler.toml` has the correct:
- Account ID
- D1 database ID
- R2 bucket name

The current configuration:
```toml
account_id = "b6641681fe423910342b9ffa1364c76d"
database_id = "7773cb8c-af79-4ae9-8473-342acbbc0444"
bucket_name = "todo-mdx-media"
```

### 4. Deploy the Payload RPC Worker

```bash
cd apps/admin
pnpm deploy
```

This will:
1. Build the worker
2. Upload to Cloudflare
3. Create the `payload-rpc` service

Verify deployment:
```bash
wrangler deployments list
```

### 5. Deploy the Main Worker

The main worker must be deployed after the Payload RPC worker so the service binding resolves correctly.

```bash
cd ../../worker
pnpm deploy
```

### 6. Test the Integration

Test that the main worker can access Payload:

```bash
# Call an endpoint that uses Payload (e.g., /api/issues)
curl https://todo-mdx.your-workers.dev/api/issues
```

## Local Development

### Start Both Workers Locally

Terminal 1 - Payload RPC Worker:
```bash
cd apps/admin
pnpm dev
```

Terminal 2 - Main Worker:
```bash
cd worker
pnpm dev
```

The main worker will automatically connect to the local Payload RPC worker via service bindings.

### Test Local RPC

```bash
# Test the main worker locally
curl http://localhost:8787/api/issues
```

## Troubleshooting

### Service binding not found

**Error**: `Service "payload-rpc" not found`

**Fix**: Deploy the Payload RPC worker first:
```bash
cd apps/admin
pnpm deploy
```

### D1 database errors

**Error**: `D1 binding "D1" not found`

**Fix**: Ensure the database exists and the ID matches in wrangler.toml:
```bash
wrangler d1 list
```

### R2 bucket errors

**Error**: `R2 binding "R2" not found`

**Fix**: Ensure the bucket exists:
```bash
wrangler r2 bucket list
```

Create if needed:
```bash
wrangler r2 bucket create todo-mdx-media
```

### TypeScript errors

**Error**: Import errors or type mismatches

**Fix**: Ensure dependencies are installed:
```bash
pnpm install
```

Rebuild:
```bash
pnpm build
```

### Payload initialization errors

**Error**: `PAYLOAD_SECRET is required`

**Fix**: Set the secret:
```bash
cd apps/admin
wrangler secret put PAYLOAD_SECRET
```

## Environment-Specific Deployment

### Staging

```bash
cd apps/admin
wrangler deploy --env staging
```

### Production

```bash
cd apps/admin
wrangler deploy --env production
```

## Monitoring

### View Logs

Real-time logs:
```bash
wrangler tail
```

Historical logs (via dashboard):
https://dash.cloudflare.com/workers

### Check Worker Status

```bash
wrangler deployments list
```

## Rollback

If something goes wrong, rollback to a previous deployment:

```bash
# List deployments
wrangler deployments list

# Rollback to specific deployment
wrangler rollback <deployment-id>
```

## CI/CD

Example GitHub Actions workflow:

```yaml
name: Deploy Payload RPC

on:
  push:
    branches: [main]
    paths:
      - 'apps/admin/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install

      - name: Deploy Payload RPC
        working-directory: apps/admin
        run: pnpm deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## Performance Tips

1. **Cache Payload Instance**: The RPC worker caches the Payload instance, so subsequent calls are fast
2. **Use Depth Parameter**: Control relationship depth to avoid over-fetching
3. **Batch Operations**: When possible, use batch operations instead of individual calls
4. **Monitor Costs**: Check Workers Analytics for usage patterns

## Security

1. **Secrets Management**: Never commit secrets to git
2. **Access Control**: Use Payload's built-in access control
3. **Service Bindings**: RPC calls are internal to Cloudflare's network
4. **Environment Variables**: Set secrets via wrangler, not in wrangler.toml

## Next Steps

After deployment:
1. Monitor logs for errors
2. Test all API endpoints
3. Verify sync operations work
4. Check performance metrics
5. Set up alerts for failures
