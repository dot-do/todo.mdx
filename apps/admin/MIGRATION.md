# Migration Guide: D1 Direct Access → Payload RPC

This guide shows how to migrate from direct D1 database access to using Payload via Workers RPC.

## Overview

**Before**: Main worker directly queries D1 database
```typescript
const issues = await env.DB.prepare('SELECT * FROM issues WHERE repo_id = ?')
  .bind(repoId)
  .all()
```

**After**: Main worker uses Payload RPC
```typescript
const issues = await env.PAYLOAD.find({
  collection: 'issues',
  where: { repo: { equals: repoId } }
})
```

## Benefits of Migration

1. **Type Safety**: Full TypeScript types for all collections
2. **Validation**: Payload validates data automatically
3. **Relationships**: Automatic handling of foreign keys and joins
4. **Hooks**: Access control, lifecycle hooks, and custom logic
5. **No SQL**: Use Payload's query builder instead of raw SQL

## Step-by-Step Migration

### 1. Update Environment Types

**Before** (`worker/src/types.ts`):
```typescript
export interface Env {
  DB: D1Database
  // ...
}
```

**After**:
```typescript
import type { PayloadRPC } from '../../apps/admin/src/rpc'

export interface Env {
  DB: D1Database  // Keep for non-Payload data
  PAYLOAD: Service<PayloadRPC>
  // ...
}
```

### 2. Replace Raw SQL Queries

#### Get Issues

**Before**:
```typescript
const result = await env.DB.prepare(`
  SELECT * FROM issues
  WHERE repo_id = ? AND state = 'open'
  ORDER BY priority DESC, created_at DESC
  LIMIT ?
`).bind(repoId, limit).all()

const issues = result.results
```

**After**:
```typescript
const issues = await env.PAYLOAD.find({
  collection: 'issues',
  where: {
    and: [
      { repo: { equals: repoId } },
      { state: { equals: 'open' } }
    ]
  },
  sort: '-priority,-createdAt',
  limit
})
```

#### Get Issue by ID

**Before**:
```typescript
const result = await env.DB.prepare('SELECT * FROM issues WHERE id = ?')
  .bind(issueId)
  .first()
```

**After**:
```typescript
const issue = await env.PAYLOAD.findByID({
  collection: 'issues',
  id: issueId
})
```

#### Create Issue

**Before**:
```typescript
await env.DB.prepare(`
  INSERT INTO issues (id, local_id, title, body, state, repo_id, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).bind(
  id,
  localId,
  title,
  body,
  'open',
  repoId,
  new Date().toISOString()
).run()
```

**After**:
```typescript
const issue = await env.PAYLOAD.create({
  collection: 'issues',
  data: {
    localId,
    title,
    body,
    state: 'open',
    repo: repoId
    // createdAt is automatic
  }
})
```

#### Update Issue

**Before**:
```typescript
await env.DB.prepare(`
  UPDATE issues
  SET state = ?, status = ?, updated_at = ?
  WHERE id = ?
`).bind('closed', 'closed', new Date().toISOString(), issueId).run()
```

**After**:
```typescript
await env.PAYLOAD.update({
  collection: 'issues',
  id: issueId,
  data: {
    state: 'closed',
    status: 'closed'
    // updatedAt is automatic
  }
})
```

#### Delete Issue

**Before**:
```typescript
await env.DB.prepare('DELETE FROM issues WHERE id = ?')
  .bind(issueId)
  .run()
```

**After**:
```typescript
await env.PAYLOAD.delete({
  collection: 'issues',
  id: issueId
})
```

### 3. Handle Relationships

**Before** (manual joins):
```typescript
const issue = await env.DB.prepare('SELECT * FROM issues WHERE id = ?')
  .bind(issueId)
  .first()

const milestone = await env.DB.prepare('SELECT * FROM milestones WHERE id = ?')
  .bind(issue.milestone_id)
  .first()

const repo = await env.DB.prepare('SELECT * FROM repos WHERE id = ?')
  .bind(issue.repo_id)
  .first()
```

**After** (automatic with depth):
```typescript
const issue = await env.PAYLOAD.findByID({
  collection: 'issues',
  id: issueId,
  depth: 2  // Populates repo and milestone
})

// Now issue.repo and issue.milestone are full objects
console.log(issue.repo.name)
console.log(issue.milestone?.title)
```

### 4. Complex Queries

#### Filter by Multiple Conditions

**Before**:
```typescript
const result = await env.DB.prepare(`
  SELECT * FROM issues
  WHERE repo_id = ?
    AND state = 'open'
    AND priority <= 2
    AND assignee IS NULL
  ORDER BY priority, created_at
  LIMIT ?
`).bind(repoId, limit).all()
```

**After**:
```typescript
const issues = await env.PAYLOAD.find({
  collection: 'issues',
  where: {
    and: [
      { repo: { equals: repoId } },
      { state: { equals: 'open' } },
      { priority: { less_than_equal: 2 } },
      { assignees: { exists: false } }
    ]
  },
  sort: 'priority,createdAt',
  limit
})
```

#### Search by Text

**Before**:
```typescript
const result = await env.DB.prepare(`
  SELECT * FROM issues
  WHERE title LIKE ? OR body LIKE ?
`).bind(`%${query}%`, `%${query}%`).all()
```

**After**:
```typescript
const issues = await env.PAYLOAD.find({
  collection: 'issues',
  where: {
    or: [
      { title: { contains: query } },
      { body: { contains: query } }
    ]
  }
})
```

#### Pagination

**Before**:
```typescript
const offset = (page - 1) * limit
const result = await env.DB.prepare(`
  SELECT * FROM issues
  LIMIT ? OFFSET ?
`).bind(limit, offset).all()
```

**After**:
```typescript
const result = await env.PAYLOAD.find({
  collection: 'issues',
  page,  // 1-indexed
  limit
})

console.log(result.docs)       // Current page items
console.log(result.totalDocs)  // Total count
console.log(result.totalPages) // Total pages
console.log(result.hasNextPage)
console.log(result.hasPrevPage)
```

### 5. Use Helper Functions

Instead of calling Payload directly everywhere, use the helper functions in `worker/src/payload.ts`:

**Direct RPC** (verbose):
```typescript
const issues = await env.PAYLOAD.find({
  collection: 'issues',
  where: {
    and: [
      { repo: { equals: repoId } },
      { state: { equals: 'open' } }
    ]
  },
  sort: '-priority',
  limit: 10
})
```

**Helper Function** (cleaner):
```typescript
import { getOpenIssues } from './payload'

const issues = await getOpenIssues(env, repoId, 10)
```

### 6. Error Handling

**Before**:
```typescript
try {
  await env.DB.prepare('INSERT INTO issues ...')
    .bind(...)
    .run()
} catch (error) {
  if (error.message.includes('UNIQUE constraint')) {
    // Handle duplicate
  }
}
```

**After**:
```typescript
try {
  await env.PAYLOAD.create({
    collection: 'issues',
    data: { ... }
  })
} catch (error) {
  if (error.name === 'ValidationError') {
    // Handle validation errors
    console.log(error.data)  // Field-specific errors
  }
}
```

## Common Patterns

### Check if Issue Exists

**Before**:
```typescript
const existing = await env.DB.prepare('SELECT id FROM issues WHERE github_id = ?')
  .bind(githubId)
  .first()

if (existing) {
  // Update
} else {
  // Create
}
```

**After**:
```typescript
const existing = await env.PAYLOAD.find({
  collection: 'issues',
  where: { githubId: { equals: githubId } },
  limit: 1
})

if (existing.docs.length > 0) {
  // Update
  await env.PAYLOAD.update({
    collection: 'issues',
    id: existing.docs[0].id,
    data: { ... }
  })
} else {
  // Create
  await env.PAYLOAD.create({
    collection: 'issues',
    data: { ... }
  })
}
```

Or use the helper:
```typescript
import { syncIssueFromGitHub } from './payload'

await syncIssueFromGitHub(env, repoId, githubIssue)
```

### Batch Operations

**Before**:
```typescript
const batch = env.DB.batch([
  env.DB.prepare('INSERT INTO issues ...').bind(...),
  env.DB.prepare('INSERT INTO issues ...').bind(...),
  env.DB.prepare('INSERT INTO issues ...').bind(...)
])
await batch
```

**After**:
```typescript
// Payload doesn't have batch create, use Promise.all for concurrency
await Promise.all(
  issues.map(issue =>
    env.PAYLOAD.create({
      collection: 'issues',
      data: issue
    })
  )
)
```

## Testing

Update tests to mock the Payload RPC binding:

**Before**:
```typescript
const mockEnv = {
  DB: {
    prepare: () => ({
      bind: () => ({
        all: () => ({ results: [...] })
      })
    })
  }
}
```

**After**:
```typescript
const mockEnv = {
  PAYLOAD: {
    find: async () => ({ docs: [...] }),
    create: async () => ({ id: '1', ... }),
    update: async () => ({ id: '1', ... }),
    delete: async () => ({ id: '1' })
  }
}
```

## Gradual Migration

You don't have to migrate everything at once. Both D1 and Payload can coexist:

1. Keep `DB` binding for non-Payload tables (auth, sessions, etc.)
2. Use `PAYLOAD` for collections (issues, repos, milestones)
3. Migrate one API route at a time
4. Test thoroughly after each migration

## Performance Considerations

1. **RPC Overhead**: Minimal, but exists. For very simple queries, direct D1 might be faster.
2. **Caching**: Payload instance is cached, so subsequent calls are fast.
3. **Depth**: Only fetch relationships you need. `depth: 0` for no relationships.
4. **Pagination**: Use pagination for large result sets instead of fetching everything.

## Rollback Plan

If you need to rollback:

1. Keep the D1 code in comments during migration
2. The `DB` binding still works, so you can switch back
3. Deploy a previous version of the worker if needed

## Getting Help

- Payload Docs: https://payloadcms.com/docs
- Cloudflare RPC Docs: https://developers.cloudflare.com/workers/runtime-apis/rpc
- Issues: Check the beads issue tracker with `bd list`
