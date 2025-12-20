# API Client for todo.mdx

This module provides a client for fetching issues from the todo.mdx.do API (Payload/Worker data source).

## Overview

The API client allows you to fetch issues from the todo.mdx.do API instead of (or in addition to) local beads or GitHub Issues. This is useful when you want to:

- Access centralized issue data across multiple repositories
- Use the todo.mdx dashboard as a single source of truth
- Leverage Linear integration or other external data sources
- Work with synced data without local beads setup

## Usage

### Basic Usage

```typescript
import { TodoApiClient, loadApiIssues } from '@todo.mdx/core'

// Using the client directly
const client = new TodoApiClient({
  baseUrl: 'https://todo.mdx.do',
  apiKey: process.env.TODO_MDX_API_KEY,
  owner: 'your-org',
  repo: 'your-repo',
})

const issues = await client.fetchIssues()
console.log(`Fetched ${issues.length} issues`)

// Or use the convenience function
const issues = await loadApiIssues({
  owner: 'your-org',
  repo: 'your-repo',
  apiKey: process.env.TODO_MDX_API_KEY,
})
```

### CLI Usage

The todo.mdx CLI supports the API source via the `--source=api` flag:

```bash
# Generate .todo/*.md files from the API
npx todo.mdx --generate --source=api

# Environment variables
export TODO_MDX_OWNER=your-org
export TODO_MDX_REPO=your-repo
export TODO_MDX_API_KEY=your-api-key
npx todo.mdx --generate --source=api
```

### TODO.mdx Frontmatter

Configure API access in your TODO.mdx frontmatter:

```yaml
---
title: TODO
api: true
owner: your-org
repo: your-repo
apiKey: your-api-key  # Or use TODO_MDX_API_KEY env var
apiUrl: https://todo.mdx.do  # Optional, defaults to https://todo.mdx.do
---

# {title}

<Stats />

## Ready to Work

<Issues.Ready limit={10} />
```

## Configuration

### ApiClientConfig

```typescript
interface ApiClientConfig {
  /** Base URL for the API (default: https://todo.mdx.do) */
  baseUrl?: string

  /** API key or OAuth token for authentication */
  apiKey?: string

  /** Repository owner/org (e.g., 'dot-do') */
  owner?: string

  /** Repository name (e.g., 'todo.mdx') */
  repo?: string
}
```

### Environment Variables

The API client uses these environment variables (with fallback to config):

- `TODO_MDX_API_URL` - API base URL (default: https://todo.mdx.do)
- `TODO_MDX_API_KEY` - Authentication token
- `TODO_MDX_OWNER` - Repository owner/org
- `TODO_MDX_REPO` - Repository name

## Filtering

The API client supports filtering issues:

```typescript
import { TodoApiClient } from '@todo.mdx/core'

const client = new TodoApiClient({ /* ... */ })

// Filter by status
const openIssues = await client.fetchIssues({ status: 'open' })

// Filter by labels
const bugs = await client.fetchIssues({ labels: ['bug'] })

// Filter by type
const features = await client.fetchIssues({ type: 'feature' })

// Filter by priority
const highPriority = await client.fetchIssues({ priority: 1 })

// Combine filters
const criticalBugs = await client.fetchIssues({
  type: 'bug',
  labels: ['critical'],
  status: 'open',
})
```

### IssueFilter

```typescript
interface IssueFilter {
  status?: 'open' | 'in_progress' | 'closed' | 'all'
  labels?: string[]
  assignee?: string
  type?: 'task' | 'bug' | 'feature' | 'epic'
  priority?: number  // 0 = critical, 1 = high, 2 = medium, 3 = low, 4 = backlog
}
```

## API Endpoints

The client uses these endpoints from the worker API:

- `GET /api/repos/:owner/:repo/issues` - List issues (with optional ?status query param)
- `GET /api/repos/:owner/:repo/issues/:id` - Get single issue

### Authentication

All requests include the API key in the Authorization header:

```
Authorization: Bearer <your-api-key>
```

## Data Mapping

The API client maps Payload issue format to the local Issue type:

| Payload Field | Issue Field | Notes |
|--------------|-------------|-------|
| `localId` | `id` | Primary identifier |
| `status` | `state` | Maps 'open', 'in_progress', 'closed' |
| `dependsOn` | `blockedBy` | Array of issue IDs that block this one |
| - | `blocks` | Computed from reverse dependencies |
| `type` | `type` | 'task', 'bug', 'feature', 'epic' |
| `milestone.title` | `milestone` | Milestone name |

## Integration with Compilation

The API client integrates seamlessly with the compilation pipeline:

```typescript
import { compile } from '@todo.mdx/core'

// Compile TODO.mdx using API data
await compile({
  input: 'TODO.mdx',
  output: 'TODO.md',
  config: {
    api: true,
    owner: 'your-org',
    repo: 'your-repo',
    apiKey: process.env.TODO_MDX_API_KEY,
  },
})
```

### Data Source Priority

When multiple data sources are enabled, they merge with this priority (highest to lowest):

1. File issues (.todo/*.md files)
2. Beads issues (local .beads database)
3. **API issues (todo.mdx.do)**
4. GitHub issues (direct GitHub API)

This means API data will override GitHub data but be overridden by local beads or file changes.

## Error Handling

The `loadApiIssues()` function silently returns an empty array on errors (matching `loadBeadsIssues()` behavior):

```typescript
const issues = await loadApiIssues(config)
// Returns [] if:
// - Owner/repo not configured
// - Network error
// - API key invalid
// - API returns error
```

For more control, use the client directly:

```typescript
const client = new TodoApiClient(config)

try {
  const issues = await client.fetchIssues()
  console.log(`Fetched ${issues.length} issues`)
} catch (error) {
  console.error('Failed to fetch issues:', error.message)
}
```

## Examples

### Example 1: Fetch and display ready issues

```typescript
import { loadApiIssues } from '@todo.mdx/core'

const issues = await loadApiIssues({
  owner: 'dot-do',
  repo: 'todo.mdx',
  apiKey: process.env.TODO_MDX_API_KEY,
})

const ready = issues.filter(i =>
  i.state === 'open' &&
  (!i.blockedBy || i.blockedBy.length === 0)
)

console.log('Ready to work:')
for (const issue of ready) {
  console.log(`- ${issue.id}: ${issue.title}`)
}
```

### Example 2: Generate markdown report

```typescript
import { TodoApiClient } from '@todo.mdx/core'

const client = new TodoApiClient({
  owner: 'dot-do',
  repo: 'todo.mdx',
  apiKey: process.env.TODO_MDX_API_KEY,
})

const issues = await client.fetchIssues({ status: 'open' })

const markdown = `# Open Issues

${issues.map(i => `- [ ] **${i.id}**: ${i.title}`).join('\n')}
`

console.log(markdown)
```

### Example 3: Combined data sources

```typescript
import { compile } from '@todo.mdx/core'

await compile({
  config: {
    beads: true,   // Load from local beads
    api: true,     // Also load from API
    owner: 'dot-do',
    repo: 'todo.mdx',
    apiKey: process.env.TODO_MDX_API_KEY,
  },
})
// Issues will be merged: file > beads > api > github
```

## Testing

The API client includes comprehensive tests. Run them with:

```bash
pnpm test src/api-client.test.ts
```

Tests cover:
- Basic API fetching
- Authentication headers
- Client-side filtering
- Reverse dependency computation (blocks relationships)
- Error handling
- Environment variable configuration
- Single issue fetch
- 404 handling

## See Also

- [Compiler Documentation](./compiler.ts) - How the API client integrates with compilation
- [Types](./types.ts) - Issue and config type definitions
- [Worker API](../../worker/src/api/issues.ts) - Backend API implementation
