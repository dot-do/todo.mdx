# todo.mdx.do

Documentation site for todo.mdx - Built with Fumadocs, OpenNext, and WorkOS AuthKit.

## Stack

- **Fumadocs** - Documentation framework with MDX support
- **OpenNext** - Next.js adapter for Cloudflare Workers
- **WorkOS AuthKit** - Authentication
- **Tailwind CSS** - Styling
- **@todo.mdx/dashboard** - Shared dashboard UI components

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
pnpm build
pnpm deploy
```

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
cp .env.example .env.local
```

Required variables:
- `WORKOS_API_KEY` - WorkOS API key
- `WORKOS_CLIENT_ID` - WorkOS client ID
- `WORKOS_REDIRECT_URI` - OAuth redirect URI
- `WORKOS_COOKIE_PASSWORD` - 32+ character password for session encryption

## Project Structure

```
apps/todo.mdx.do/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout with Fumadocs provider
│   ├── page.tsx           # Home page
│   ├── docs/              # Documentation routes
│   └── dashboard/         # Dashboard using @todo.mdx/dashboard
├── content/docs/          # MDX documentation files
├── source.config.ts       # Fumadocs source configuration
├── next.config.ts         # Next.js configuration
├── open-next.config.ts    # OpenNext Cloudflare configuration
└── wrangler.jsonc         # Cloudflare deployment config
```

## Routes

- `/` - Home page
- `/docs` - Documentation (Fumadocs)
- `/dashboard` - Dashboard (shared component from @todo.mdx/dashboard)

## Adding Documentation

Add MDX files to `content/docs/` and update `content/docs/meta.json`:

```json
{
  "title": "Documentation",
  "pages": ["index", "your-new-page"]
}
```
