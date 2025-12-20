# Deployment Guide

Deploy cli.mdx.do to Cloudflare Workers using OpenNext.

## Prerequisites

1. **Cloudflare Account** - Sign up at https://cloudflare.com
2. **Wrangler CLI** - Already included in devDependencies
3. **WorkOS Account** - For authentication (https://workos.com)

## Environment Setup

1. Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

2. Configure WorkOS credentials:

```env
WORKOS_API_KEY=sk_test_...        # From WorkOS Dashboard
WORKOS_CLIENT_ID=client_...       # From WorkOS Dashboard
WORKOS_REDIRECT_URI=https://cli.mdx.do/auth/callback
```

3. Update `wrangler.jsonc` with your WorkOS credentials for production.

## Build Process

The build process has two steps:

1. **Next.js Build** - Compiles the Next.js app
2. **OpenNext Build** - Converts Next.js output to Cloudflare Worker format

Run the full build:

```bash
pnpm build
```

This will:
- Build the Next.js app to `.next/`
- Run OpenNext to generate `.open-next/` directory
- Create a Cloudflare Worker in `.open-next/worker.js`
- Prepare static assets in `.open-next/assets/`

## Local Preview

Test the Cloudflare Worker locally:

```bash
pnpm preview
```

This runs `wrangler dev` which serves the built worker locally on port 8787 (by default).

## Deploy to Cloudflare

### First Time Setup

1. **Authenticate with Cloudflare:**

```bash
npx wrangler login
```

2. **Create the Worker:**

The first deployment will create the worker:

```bash
pnpm deploy
```

### Subsequent Deployments

Just run:

```bash
pnpm deploy
```

### Set Environment Variables

Set production secrets via Wrangler:

```bash
npx wrangler secret put WORKOS_API_KEY
npx wrangler secret put WORKOS_CLIENT_ID
```

## Custom Domain

1. In Cloudflare Dashboard, go to Workers & Pages
2. Select your worker `cli-mdx-do`
3. Go to Settings > Triggers
4. Add Custom Domain: `cli.mdx.do`
5. Update `WORKOS_REDIRECT_URI` in wrangler.jsonc to use the custom domain

## Verify Deployment

After deployment, verify:

1. **Homepage** - https://cli.mdx.do
2. **Docs** - https://cli.mdx.do/docs
3. **Dashboard** - https://cli.mdx.do/dashboard
4. **Auth** - Try signing in to test WorkOS

## Continuous Deployment

For CI/CD, use GitHub Actions:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build
        working-directory: apps/cli.mdx.do
      - run: npx wrangler deploy
        working-directory: apps/cli.mdx.do
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## Troubleshooting

### Build Fails

- Ensure all dependencies are installed: `pnpm install`
- Check TypeScript errors: `pnpm typecheck`
- Verify fumadocs config in `source.config.ts`

### Worker Deployment Fails

- Check wrangler.jsonc syntax (must be valid JSON)
- Verify Cloudflare authentication: `npx wrangler whoami`
- Check worker size limits (max 1MB compressed)

### Auth Not Working

- Verify WorkOS credentials are set correctly
- Check redirect URI matches exactly in WorkOS Dashboard
- Ensure middleware.ts is in the root directory

## Monitoring

View worker metrics and logs:

```bash
npx wrangler tail
```

Or in Cloudflare Dashboard:
- Workers & Pages > cli-mdx-do > Metrics
- Real-time logs and analytics

## Resources

- [OpenNext Documentation](https://opennext.js.org)
- [Cloudflare Workers](https://developers.cloudflare.com/workers)
- [WorkOS Documentation](https://workos.com/docs)
- [Fumadocs](https://fumadocs.vercel.app)
