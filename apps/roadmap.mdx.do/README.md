# roadmap.mdx.do

Fumadocs documentation site for the roadmap.mdx package.

## Features

- **Fumadocs** - Documentation framework with MDX support
- **OpenNext** - Cloudflare Workers deployment via @opennextjs/cloudflare
- **WorkOS AuthKit** - Authentication for dashboard access
- **Shared Dashboard** - Uses @todo.mdx/dashboard package

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Type check
pnpm typecheck
```

## Deployment

Deploy to Cloudflare Pages:

```bash
# Build and deploy
pnpm deploy

# Or deploy via Wrangler
pnpm pages:build
wrangler pages deploy .vercel/output/static
```

## Project Structure

```
apps/roadmap.mdx.do/
├── app/
│   ├── layout.tsx           # Root layout with Fumadocs provider
│   ├── page.tsx             # Homepage
│   ├── docs/                # Documentation routes
│   └── dashboard/           # Dashboard using shared package
├── content/docs/            # MDX documentation content
├── lib/
│   ├── source.ts           # Fumadocs source configuration
│   └── layout-config.ts    # Layout options
├── next.config.ts          # Next.js + Fumadocs config
├── open-next.config.ts     # OpenNext Cloudflare config
└── wrangler.jsonc          # Cloudflare Pages config
```

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

- `WORKOS_API_KEY` - WorkOS API key
- `WORKOS_CLIENT_ID` - WorkOS client ID
- `WORKOS_REDIRECT_URI` - OAuth callback URL
- `NEXT_PUBLIC_APP_URL` - Public app URL

## Routes

- `/` - Homepage
- `/docs` - Documentation (Fumadocs)
- `/dashboard` - Dashboard (shared @todo.mdx/dashboard package)

## Learn More

- [Fumadocs Documentation](https://fumadocs.vercel.app)
- [OpenNext Cloudflare](https://opennext.js.org/cloudflare)
- [WorkOS AuthKit](https://workos.com/docs/user-management/authkit)
