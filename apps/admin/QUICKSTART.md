# Payload RPC Quick Start

Get up and running with Payload RPC in 5 minutes.

## TL;DR

```bash
# 1. Install dependencies
pnpm install

# 2. Set secret
cd apps/admin
wrangler secret put PAYLOAD_SECRET

# 3. Deploy Payload RPC worker
pnpm deploy

# 4. Deploy main worker
cd ../../worker
pnpm deploy

# 5. Use in code
const issues = await env.PAYLOAD.find({ collection: 'issues' })
```

## Basic Usage

### Query Issues

```typescript
// Get all open issues
const result = await env.PAYLOAD.find({
  collection: 'issues',
  where: { state: { equals: 'open' } },
  limit: 10,
})

console.log(result.docs)       // Array of issues
console.log(result.totalDocs)  // Total count
```

### Get Single Issue

```typescript
const issue = await env.PAYLOAD.findByID({
  collection: 'issues',
  id: 'issue-id-here',
  depth: 1,  // Include related repo
})

console.log(issue.title)
console.log(issue.repo.name)  // Populated
```

### Create Issue

```typescript
const newIssue = await env.PAYLOAD.create({
  collection: 'issues',
  data: {
    localId: 'todo-abc',
    title: 'Fix the bug',
    state: 'open',
    repo: 'repo-id-here',
    priority: 1,
  },
})
```

### Update Issue

```typescript
await env.PAYLOAD.update({
  collection: 'issues',
  id: 'issue-id',
  data: {
    state: 'closed',
    status: 'closed',
  },
})
```

### Delete Issue

```typescript
await env.PAYLOAD.delete({
  collection: 'issues',
  id: 'issue-id',
})
```

## Helper Functions

Instead of calling Payload directly, use the helpers in `worker/src/payload.ts`:

```typescript
import {
  getOpenIssues,
  getReadyIssues,
  createIssue,
  updateIssue,
  closeIssue,
} from './payload'

// Get open issues
const issues = await getOpenIssues(env, repoId)

// Get ready to work
const ready = await getReadyIssues(env, repoId, 5)

// Create issue
const issue = await createIssue(env, {
  localId: 'todo-xyz',
  title: 'New feature',
  repoId: 'repo-id',
  priority: 1,
})

// Close issue
await closeIssue(env, issueId, 'Completed')
```

## Available Collections

- `issues` - Issues/todos
- `repos` - Repositories
- `milestones` - Milestones
- `installations` - GitHub installations
- `sync-events` - Sync event log
- `users` - User accounts
- `media` - Media files

## Query Operators

```typescript
// Equals
{ state: { equals: 'open' } }

// Not equals
{ state: { not_equals: 'closed' } }

// Greater than / less than
{ priority: { less_than: 3 } }
{ priority: { greater_than_equal: 1 } }

// Contains (text search)
{ title: { contains: 'bug' } }

// In array
{ state: { in: ['open', 'in_progress'] } }

// Exists
{ milestone: { exists: true } }

// AND conditions
{ and: [
  { state: { equals: 'open' } },
  { priority: { less_than: 3 } }
]}

// OR conditions
{ or: [
  { state: { equals: 'open' } },
  { status: { equals: 'in_progress' } }
]}
```

## Relationships

Use `depth` to populate relationships:

```typescript
const issue = await env.PAYLOAD.findByID({
  collection: 'issues',
  id: issueId,
  depth: 2,
})

// depth: 0 - No relationships (default)
// depth: 1 - First level (repo, milestone)
// depth: 2 - Second level (repo.installation, etc.)
```

## Sorting

```typescript
// Single field
{ sort: '-createdAt' }  // Descending
{ sort: 'priority' }    // Ascending

// Multiple fields
{ sort: '-priority,-createdAt' }
```

## Pagination

```typescript
const result = await env.PAYLOAD.find({
  collection: 'issues',
  page: 1,    // 1-indexed
  limit: 20,
})

console.log(result.docs)         // Current page
console.log(result.page)         // Current page number
console.log(result.totalPages)   // Total pages
console.log(result.hasNextPage)  // Boolean
console.log(result.hasPrevPage)  // Boolean
```

## Error Handling

```typescript
try {
  await env.PAYLOAD.create({
    collection: 'issues',
    data: { ... }
  })
} catch (error) {
  if (error.name === 'ValidationError') {
    // Field validation failed
    console.log(error.data)  // { field: ['error message'] }
  }
  throw error
}
```

## Local Development

```bash
# Terminal 1 - Payload RPC
cd apps/admin
pnpm dev

# Terminal 2 - Main worker
cd worker
pnpm dev

# Test
curl http://localhost:8787/api/issues
```

## Common Patterns

### Upsert (find or create)

```typescript
const existing = await env.PAYLOAD.find({
  collection: 'issues',
  where: { githubId: { equals: 123 } },
  limit: 1,
})

if (existing.docs.length > 0) {
  await env.PAYLOAD.update({
    collection: 'issues',
    id: existing.docs[0].id,
    data: { ... }
  })
} else {
  await env.PAYLOAD.create({
    collection: 'issues',
    data: { ... }
  })
}
```

### Bulk operations

```typescript
// Create multiple
await Promise.all(
  items.map(item =>
    env.PAYLOAD.create({
      collection: 'issues',
      data: item
    })
  )
)
```

## Next Steps

- Read the full [README.md](./README.md) for detailed usage
- Check [MIGRATION.md](./MIGRATION.md) for migrating from D1
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment guide

## Troubleshooting

**Service not found**: Deploy the Payload RPC worker first
```bash
cd apps/admin && pnpm deploy
```

**Type errors**: Ensure types are imported correctly
```typescript
import type { PayloadRPC } from '../../apps/admin/src/rpc'
```

**D1 errors**: Check database ID matches in both wrangler.toml files

**Secret missing**: Set the Payload secret
```bash
wrangler secret put PAYLOAD_SECRET
```
