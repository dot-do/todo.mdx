# cli.mdx.do

Documentation site for the cli.mdx package - Build beautiful CLIs with MDX components.

## Features

- **Fumadocs** - Beautiful documentation UI
- **OpenNext** - Cloudflare Workers deployment
- **WorkOS AuthKit** - Authentication
- **Dashboard** - Shared dashboard via `@todo.mdx/dashboard`

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Type check
pnpm typecheck
```

## Project Structure

```
cli.mdx.do/
├── app/
│   ├── layout.tsx              # Root layout with Fumadocs provider
│   ├── page.tsx                # Landing page
│   ├── docs/                   # Documentation routes
│   │   ├── layout.tsx          # Docs layout
│   │   └── [[...slug]]/        # Dynamic doc pages
│   ├── dashboard/              # Dashboard routes
│   │   └── [[...path]]/        # Uses @todo.mdx/dashboard
│   └── auth/
│       └── callback/           # WorkOS auth callback
├── content/docs/               # MDX documentation files
├── lib/
│   └── source.ts               # Fumadocs source configuration
├── source.config.ts            # MDX configuration
├── next.config.ts              # Next.js config with MDX
├── open-next.config.ts         # OpenNext Cloudflare config
└── wrangler.jsonc              # Cloudflare Workers config
```

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
WORKOS_API_KEY=sk_test_...
WORKOS_CLIENT_ID=client_...
WORKOS_REDIRECT_URI=http://localhost:3000/auth/callback
```

## Deployment

Build and deploy to Cloudflare Workers:

```bash
# Build Next.js app
pnpm build

# Build OpenNext worker
npx @opennextjs/cloudflare

# Deploy with Wrangler
pnpm wrangler deploy
```

## Dashboard Integration

The dashboard at `/dashboard` uses the shared `@todo.mdx/dashboard` package from the monorepo workspace, providing a consistent UI across all todo.mdx sites.

## Documentation

Documentation is written in MDX files in `content/docs/` and automatically rendered by Fumadocs.

To add new pages:
1. Create a new `.mdx` file in `content/docs/`
2. Add frontmatter with `title` and `description`
3. Update `content/docs/meta.json` if needed

## License

MIT
