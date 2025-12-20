# Payload RPC Worker

This worker exports the Payload CMS instance via Cloudflare Workers RPC, allowing other workers to access Payload through service bindings.

## Architecture

```
Main Worker (worker/)
    ↓ (service binding: PAYLOAD)
Payload RPC Worker (apps/admin/)
    ↓ (D1 + R2 bindings)
Payload CMS
    ↓
Collections (Issues, Repos, etc.)
```

## Setup

### 1. Install Dependencies

```bash
cd apps/admin
pnpm install
```

### 2. Set Secrets

```bash
# Set the Payload secret
wrangler secret put PAYLOAD_SECRET
```

### 3. Deploy

```bash
# Deploy the Payload RPC worker
pnpm deploy

# Deploy the main worker (automatically uses the service binding)
cd ../../worker
pnpm deploy
```

## Usage in Main Worker

The main worker can now access Payload through the `env.PAYLOAD` service binding:

```typescript
import type { Env } from './types'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Get the Payload instance
    const payload = await env.PAYLOAD.getPayload()

    // Use Payload directly
    const issues = await payload.find({
      collection: 'issues',
      where: { state: { equals: 'open' } },
      limit: 10,
    })

    return Response.json(issues)
  }
}
```

### Available Methods

The `PayloadRPC` class exposes these methods:

#### `getPayload()`
Returns the Payload instance for direct access to all Payload methods.

```typescript
const payload = await env.PAYLOAD.getPayload()
const result = await payload.find({ collection: 'issues' })
```

#### `find(params)`
Direct access to find operations.

```typescript
const issues = await env.PAYLOAD.find({
  collection: 'issues',
  where: { state: { equals: 'open' } },
  limit: 10,
  page: 1,
  sort: '-createdAt',
  depth: 2,
})
```

#### `findByID(params)`
Find a single document by ID.

```typescript
const issue = await env.PAYLOAD.findByID({
  collection: 'issues',
  id: '123',
  depth: 2,
})
```

#### `create(params)`
Create a new document.

```typescript
const newIssue = await env.PAYLOAD.create({
  collection: 'issues',
  data: {
    localId: 'todo-abc',
    title: 'New issue',
    state: 'open',
    repo: 'repo-id-here',
  },
})
```

#### `update(params)`
Update an existing document.

```typescript
const updated = await env.PAYLOAD.update({
  collection: 'issues',
  id: '123',
  data: {
    state: 'closed',
    closedAt: new Date().toISOString(),
  },
})
```

#### `delete(params)`
Delete a document.

```typescript
await env.PAYLOAD.delete({
  collection: 'issues',
  id: '123',
})
```

## Collections

The following collections are available:

- `installations` - GitHub App installations
- `repos` - Repositories
- `issues` - Issues/todos
- `milestones` - Milestones
- `sync-events` - Sync event log
- `users` - User accounts
- `media` - Media files (stored in R2)

## Development

### Local Development

```bash
# Start the Payload RPC worker locally
pnpm dev
```

This starts the worker with local bindings to D1 and R2.

### Testing RPC Calls

You can test the RPC interface locally using wrangler:

```bash
# In one terminal, start the Payload RPC worker
cd apps/admin
pnpm dev

# In another terminal, test it from the main worker
cd worker
pnpm dev
```

The main worker will automatically connect to the local Payload RPC worker.

## Configuration

### wrangler.toml

The Payload RPC worker is configured in `apps/admin/wrangler.toml`:

- D1 binding: `D1` (todo-mdx database)
- R2 binding: `R2` (todo-mdx-media bucket)
- Entry point: `src/rpc.ts` (exports `PayloadRPC` class)

### Service Binding

The main worker's `wrangler.toml` includes:

```toml
[[services]]
binding = "PAYLOAD"
service = "payload-rpc"
entrypoint = "PayloadRPC"
```

This binds `env.PAYLOAD` to the `PayloadRPC` class from the `payload-rpc` worker.

## Troubleshooting

### "Service not found" error

Make sure the Payload RPC worker is deployed:

```bash
cd apps/admin
pnpm deploy
```

### Type errors with PayloadRPC

Ensure the worker's types are importing correctly:

```typescript
import type { PayloadRPC } from '../../apps/admin/src/rpc'
```

### D1 or R2 binding errors

Verify the bindings match between the two wrangler.toml files. Both should reference the same database and bucket.

## Why Workers RPC?

Workers RPC provides several benefits:

1. **Type Safety** - Full TypeScript types across workers
2. **No HTTP Overhead** - Direct function calls, no serialization
3. **Automatic Batching** - Cloudflare optimizes RPC calls
4. **Shared State** - Payload instance is cached in the RPC worker
5. **Clean Separation** - Payload logic isolated from main worker

This pattern allows the main worker to focus on API routes, webhooks, and MCP, while the Payload RPC worker handles all CMS operations.
