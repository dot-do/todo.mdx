# readme.mdx.do

Documentation site for readme.mdx - MDX components for beautiful README files.

## Features

- **Fumadocs**: Beautiful documentation UI with search and navigation
- **OpenNext**: Deployed to Cloudflare Workers for edge performance
- **WorkOS AuthKit**: Authentication for the dashboard
- **Shared Dashboard**: Uses `@todo.mdx/dashboard` package

## Development

```bash
pnpm dev
```

Visit http://localhost:3000

## Build

```bash
pnpm build
```

## Deploy

```bash
pnpm deploy
```

## Structure

- `/app` - Next.js app router pages
- `/content/docs` - MDX documentation content
- `/src` - Source files and utilities
- `source.config.ts` - Fumadocs configuration
- `open-next.config.ts` - OpenNext Cloudflare configuration
- `wrangler.jsonc` - Cloudflare Workers configuration
