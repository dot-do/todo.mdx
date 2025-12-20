# API Client Implementation Summary

**Issue**: todo-si1 - Implement the todo.mdx API client for Payload/Worker data source

## Overview

This implementation adds a fully functional API client to the todo.mdx package that fetches issues from the todo.mdx.do Cloudflare Worker API (backed by Payload CMS).

## Files Created

### Core Implementation

1. **`src/api-client.ts`** (7.1 KB)
   - `TodoApiClient` class - Main API client
   - `loadApiIssues()` function - Convenience wrapper matching loadBeadsIssues() signature
   - `ApiClientConfig` interface - Configuration options
   - `IssueFilter` interface - Filtering options
   - Payload issue mapping logic
   - Reverse dependency computation for `blocks` relationships

2. **`src/api-client.test.ts`** (7.3 KB)
   - 10 comprehensive test cases covering:
     - Basic issue fetching
     - Authentication headers
     - Client-side filtering
     - Reverse dependency computation
     - Error handling
     - Environment variable configuration
     - Single issue fetch
     - 404 handling

3. **`src/api-client.README.md`** (7.3 KB)
   - Complete API documentation
   - Usage examples
   - Configuration guide
   - Data mapping reference
   - Error handling patterns

4. **`API_CLIENT_EXAMPLE.md`** (6.1 KB)
   - End-to-end usage examples
   - Quick start guide
   - Programmatic usage
   - Multi-source compilation
   - Development workflow

### Updated Files

1. **`src/types.ts`**
   - Added `api: boolean` to TodoConfig
   - Added `apiUrl?: string` to TodoConfig
   - Added `apiKey?: string` to TodoConfig
   - Added `'api'` to SyncSource union type

2. **`src/compiler.ts`**
   - Added `loadApiIssuesInternal()` helper function
   - Updated `compile()` to load API issues when `config.api = true`
   - Integrated API issues into merge priority: file > beads > api > github
   - Parse API config from frontmatter (api, apiUrl, apiKey)

3. **`src/index.ts`**
   - Export `TodoApiClient` class
   - Export `loadApiIssues` function
   - Export `ApiClientConfig` type
   - Export `IssueFilter` type

4. **`src/cli.ts`**
   - Added `import { loadApiIssues }`
   - Implemented `--source=api` flag for `--generate` command
   - Parse API config from TODO.mdx frontmatter
   - Support TODO_MDX_OWNER, TODO_MDX_REPO, TODO_MDX_API_KEY env vars
   - Comprehensive error messages for missing configuration

## Features Implemented

### 1. API Client Class

```typescript
const client = new TodoApiClient({
  baseUrl: 'https://todo.mdx.do',
  apiKey: process.env.TODO_MDX_API_KEY,
  owner: 'dot-do',
  repo: 'todo.mdx',
})

const issues = await client.fetchIssues({ status: 'open' })
```

### 2. Convenience Function

```typescript
// Matches loadBeadsIssues() signature
const issues = await loadApiIssues({
  owner: 'dot-do',
  repo: 'todo.mdx',
  apiKey: process.env.TODO_MDX_API_KEY,
})
```

### 3. CLI Integration

```bash
# Generate from API
npx todo.mdx --generate --source=api

# With env vars
export TODO_MDX_OWNER=dot-do
export TODO_MDX_REPO=todo.mdx
export TODO_MDX_API_KEY=your-key
npx todo.mdx --generate --source=api
```

### 4. Frontmatter Configuration

```yaml
---
title: TODO
api: true
owner: dot-do
repo: todo.mdx
apiKey: your-key  # Or use TODO_MDX_API_KEY env var
---
```

### 5. Client-Side Filtering

```typescript
const bugs = await client.fetchIssues({ type: 'bug' })
const critical = await client.fetchIssues({ priority: 0 })
const ready = await client.fetchIssues({
  status: 'open',
  labels: ['ready'],
})
```

### 6. Reverse Dependency Computation

The client automatically computes `blocks` relationships from `blockedBy`:

```typescript
// If issue B depends on issue A:
// A.blocks = ['B']  (computed)
// B.blockedBy = ['A']  (from API)
```

### 7. Data Mapping

Maps Payload CMS format to local Issue type:
- `localId` → `id`
- `status` → `state`
- `dependsOn` → `blockedBy`
- Computes `blocks` from reverse dependencies
- Flattens milestone object to string

## API Endpoints Used

- `GET /api/repos/:owner/:repo/issues` - List issues
  - Optional query param: `?status=open|in_progress|closed`
- `GET /api/repos/:owner/:repo/issues/:id` - Get single issue

## Authentication

Uses Bearer token authentication:

```http
GET /api/repos/dot-do/todo.mdx/issues
Authorization: Bearer <your-api-key>
Content-Type: application/json
```

## Configuration

### Environment Variables

- `TODO_MDX_API_URL` - Base URL (default: https://todo.mdx.do)
- `TODO_MDX_API_KEY` - Authentication token (required)
- `TODO_MDX_OWNER` - Repository owner (required)
- `TODO_MDX_REPO` - Repository name (required)

### Frontmatter

```yaml
---
api: true
apiUrl: https://todo.mdx.do  # Optional
apiKey: your-key             # Optional if using env var
owner: your-org
repo: your-repo
---
```

## Data Source Priority

When multiple sources are enabled:

1. **File** (.todo/*.md) - Manual edits always win
2. **Beads** (local .beads/) - Local database overrides API
3. **API** (todo.mdx.do) - **NEW: Overrides GitHub**
4. **GitHub** (direct API) - Lowest priority

## Error Handling

- `loadApiIssues()` returns `[]` on error (silent fail, matches loadBeadsIssues)
- `TodoApiClient` throws exceptions for better error control
- Validates owner/repo configuration before making requests
- Handles 404s gracefully for single issue fetch

## Testing

All tests pass (10/10):

```bash
✓ src/api-client.test.ts (10 tests) 5ms
  ✓ TodoApiClient > should fetch issues from the API
  ✓ TodoApiClient > should apply client-side filters
  ✓ TodoApiClient > should compute reverse blocks relationships
  ✓ TodoApiClient > should handle missing configuration gracefully
  ✓ TodoApiClient > should fetch single issue by ID
  ✓ TodoApiClient > should return null for 404 on single issue fetch
  ✓ loadApiIssues > should load issues with config
  ✓ loadApiIssues > should return empty array if not configured
  ✓ loadApiIssues > should use environment variables
  ✓ loadApiIssues > should return empty array on error
```

## Build Status

```bash
✓ Build successful (tsup)
✓ Type check passed (tsc)
✓ All tests passed (vitest)
```

## Usage Examples

### Basic Compilation

```bash
npx todo.mdx  # Compiles with all enabled sources
```

### API-Only Mode

```yaml
---
title: TODO
api: true
beads: false
owner: dot-do
repo: todo.mdx
---
```

### Programmatic

```typescript
import { loadApiIssues } from '@todo.mdx/core'

const issues = await loadApiIssues()
console.log(`Found ${issues.length} issues`)
```

## Dependencies

- **Zero external dependencies** - Uses native fetch()
- Compatible with Node.js 20+
- Works in Cloudflare Workers, Deno, Bun

## Security

- API keys should be stored in environment variables, not committed
- Bearer token authentication
- HTTPS required (default: https://todo.mdx.do)

## Next Steps

Potential enhancements (not in scope for todo-si1):

1. Pagination support for large issue sets
2. Write operations (create/update issues via API)
3. Webhook support for real-time updates
4. Caching layer (like GitHub client has)
5. Batch operations
6. GraphQL endpoint support

## Related Issues

- Resolves: **todo-si1** - Implement todo.mdx API client for Payload/Worker data source
- Integrates with: Worker API (`worker/src/api/issues.ts`)
- Uses: Payload CMS types (`apps/admin/src/payload-types.ts`)

## Documentation

- [API Client README](./src/api-client.README.md) - Full API documentation
- [API Client Example](./API_CLIENT_EXAMPLE.md) - Usage examples and workflows
- [Implementation Summary](./API_CLIENT_IMPLEMENTATION.md) - This file

---

**Status**: ✅ Complete and tested
**Tests**: 10/10 passing
**Build**: ✅ Success
**Type Check**: ✅ No errors
