# claude.mdx.do

Documentation site for claude.mdx - built with Fumadocs, deployed on Cloudflare Workers with OpenNext.

## Features

- **Fumadocs** - Beautiful documentation UI
- **OpenNext** - Cloudflare Workers deployment
- **WorkOS AuthKit** - Authentication
- **Dashboard** - Integrated dashboard using `@todo.mdx/dashboard`

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Type check
pnpm typecheck

# Build
pnpm build
```

## Deployment

```bash
# Deploy to Cloudflare Workers
pnpm deploy
```

## Structure

```
apps/claude.mdx.do/
├── app/
│   ├── layout.tsx                     # Root layout
│   ├── page.tsx                       # Homepage
│   ├── docs/[[...slug]]/page.tsx     # Docs pages
│   └── dashboard/[[...path]]/page.tsx # Dashboard (uses @todo.mdx/dashboard)
├── content/docs/                      # MDX documentation
├── source.config.ts                   # Fumadocs config
├── next.config.ts                     # Next.js config
├── open-next.config.ts                # OpenNext config
└── wrangler.jsonc                     # Cloudflare config
```

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Set the following:
- `WORKOS_API_KEY` - WorkOS API key
- `WORKOS_CLIENT_ID` - WorkOS client ID
- `WORKOS_REDIRECT_URI` - OAuth callback URL

## Dashboard

The `/dashboard` route uses the shared `@todo.mdx/dashboard` package, which provides:
- Issue management UI
- Project statistics
- Roadmap visualization

## Documentation

Add new documentation by creating MDX files in `content/docs/`.

## License

MIT
