# agents.mdx.do

Documentation site for the agents.mdx package.

## Tech Stack

- **Framework**: Next.js 15
- **Documentation**: Fumadocs
- **Deployment**: Cloudflare Workers (OpenNext)
- **Auth**: WorkOS AuthKit
- **Dashboard**: Shared `@todo.mdx/dashboard` package

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Type check
pnpm typecheck

# Build for production
pnpm build
```

## Deployment

The site is configured for deployment to Cloudflare Workers using OpenNext.

```bash
# Deploy to Cloudflare
npx wrangler deploy
```

## Structure

- `app/` - Next.js app router pages and layouts
- `content/docs/` - MDX documentation files
- `source.config.ts` - Fumadocs source configuration
- `open-next.config.ts` - OpenNext Cloudflare configuration
- `wrangler.jsonc` - Cloudflare Workers configuration

## Dashboard

The `/dashboard` route uses the shared `@todo.mdx/dashboard` package for a consistent admin experience across all todo.mdx sites.
