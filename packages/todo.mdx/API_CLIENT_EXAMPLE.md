# API Client Integration Example

This document shows how the todo.mdx API client works end-to-end.

## Quick Start

### 1. Set up environment

```bash
export TODO_MDX_API_KEY="your-api-key-here"
export TODO_MDX_OWNER="your-org"
export TODO_MDX_REPO="your-repo"
```

### 2. Create TODO.mdx with API source

```yaml
---
title: My Project TODO
api: true
owner: your-org
repo: your-repo
filePattern: "[id]-[title].md"
outputs:
  - TODO.md
  - .todo/*.md
---

# {title}

<Stats />

## Ready to Work

<Issues.Ready limit={5} />

## In Progress

<Issues.InProgress />

## Blocked

<Issues.Blocked />

## All Open

<Issues.Open />
```

### 3. Run compilation

```bash
npx todo.mdx
```

This will:
1. Fetch issues from `https://todo.mdx.do/api/repos/your-org/your-repo/issues`
2. Compile TODO.mdx → TODO.md with live issue data
3. Generate individual .todo/*.md files for each issue

### 4. Generate individual issue files

```bash
npx todo.mdx --generate --source=api
```

This creates files like:
- `.todo/todo-abc-implement-feature.md`
- `.todo/todo-def-fix-bug.md`
- `.todo/todo-ghi-add-tests.md`

## Programmatic Usage

### Fetch and display issues

```typescript
#!/usr/bin/env node
import { loadApiIssues } from '@todo.mdx/core'

async function main() {
  const issues = await loadApiIssues({
    owner: 'dot-do',
    repo: 'todo.mdx',
    apiKey: process.env.TODO_MDX_API_KEY,
  })

  console.log(`📋 Total issues: ${issues.length}`)

  const byState = {
    open: issues.filter(i => i.state === 'open').length,
    in_progress: issues.filter(i => i.state === 'in_progress').length,
    closed: issues.filter(i => i.state === 'closed').length,
  }

  console.log(`✅ Open: ${byState.open}`)
  console.log(`🔄 In Progress: ${byState.in_progress}`)
  console.log(`✓  Closed: ${byState.closed}`)

  const ready = issues.filter(i =>
    i.state === 'open' &&
    (!i.blockedBy || i.blockedBy.length === 0)
  )

  console.log(`\n🚀 Ready to work (${ready.length}):`)
  for (const issue of ready.slice(0, 5)) {
    console.log(`  - ${issue.id}: ${issue.title}`)
  }
}

main().catch(console.error)
```

### Custom filtering

```typescript
import { TodoApiClient } from '@todo.mdx/core'

const client = new TodoApiClient({
  owner: 'dot-do',
  repo: 'todo.mdx',
  apiKey: process.env.TODO_MDX_API_KEY,
})

// Get high-priority bugs
const criticalBugs = await client.fetchIssues({
  type: 'bug',
  priority: 0, // Critical
  status: 'open',
})

console.log('🔥 Critical bugs:')
for (const bug of criticalBugs) {
  console.log(`  - ${bug.id}: ${bug.title}`)
  if (bug.assignees?.length) {
    console.log(`    Assigned to: ${bug.assignees.join(', ')}`)
  }
}
```

### Multi-source compilation

```typescript
import { compile } from '@todo.mdx/core'

// Merge data from multiple sources
await compile({
  config: {
    // Enable all sources
    beads: true,   // Local .beads database
    api: true,     // todo.mdx.do API
    owner: 'dot-do',
    repo: 'todo.mdx',
    apiKey: process.env.TODO_MDX_API_KEY,
  },
})

// Priority: file > beads > api > github
// This means:
// 1. Manual edits in .todo/*.md always win
// 2. Local beads changes override API
// 3. API data overrides GitHub
```

## API Response Format

The worker API returns issues in Payload CMS format:

```json
{
  "issues": [
    {
      "id": 123,
      "localId": "todo-abc",
      "title": "Implement feature X",
      "body": "Description...",
      "status": "open",
      "priority": 2,
      "labels": ["feature", "backend"],
      "assignees": ["user1"],
      "type": "feature",
      "githubNumber": 456,
      "githubId": 789,
      "dependsOn": [
        { "id": 122, "localId": "todo-xyz" }
      ],
      "milestone": {
        "id": 1,
        "title": "v1.0"
      },
      "createdAt": "2025-01-20T10:00:00Z",
      "updatedAt": "2025-01-20T11:00:00Z"
    }
  ]
}
```

The client maps this to the local Issue type:

```typescript
{
  id: "todo-abc",
  title: "Implement feature X",
  body: "Description...",
  state: "open",
  priority: 2,
  labels: ["feature", "backend"],
  assignees: ["user1"],
  type: "feature",
  githubNumber: 456,
  githubId: 789,
  blockedBy: ["todo-xyz"],
  blocks: [],  // Computed from reverse dependencies
  milestone: "v1.0",
  createdAt: "2025-01-20T10:00:00Z",
  updatedAt: "2025-01-20T11:00:00Z"
}
```

## Authentication

The API client uses Bearer token authentication:

```bash
# Set your API key
export TODO_MDX_API_KEY="your-key-here"

# Or configure in TODO.mdx frontmatter
---
apiKey: your-key-here  # Not recommended for version control!
---
```

**Security note**: Store API keys in environment variables, not in committed files.

## Error Handling

The `loadApiIssues()` function fails gracefully:

```typescript
// Returns empty array on error (no exceptions thrown)
const issues = await loadApiIssues()

if (issues.length === 0) {
  console.log('No issues found or API unavailable')
}
```

For production use with better error handling:

```typescript
import { TodoApiClient } from '@todo.mdx/core'

const client = new TodoApiClient({
  owner: process.env.TODO_MDX_OWNER,
  repo: process.env.TODO_MDX_REPO,
  apiKey: process.env.TODO_MDX_API_KEY,
})

try {
  const issues = await client.fetchIssues()
  console.log(`✓ Fetched ${issues.length} issues`)
} catch (error) {
  if (error.message.includes('Repository owner and name')) {
    console.error('❌ Missing configuration: TODO_MDX_OWNER and TODO_MDX_REPO required')
  } else if (error.message.includes('401')) {
    console.error('❌ Authentication failed: Check TODO_MDX_API_KEY')
  } else {
    console.error('❌ API error:', error.message)
  }
  process.exit(1)
}
```

## Development Workflow

### 1. Fetch latest issues from API

```bash
npx todo.mdx --generate --source=api
```

### 2. Edit issues locally

Edit files in `.todo/*.md` to add notes, update status, etc.

### 3. Compile updated TODO.md

```bash
npx todo.mdx
```

### 4. Push changes back (via GitHub/beads sync)

The API client is read-only. To push changes:

1. Use beads to sync local changes: `bd sync`
2. Or commit .todo files and let GitHub sync handle it
3. Or use the dashboard to edit issues

## Comparison with Other Sources

| Feature | API | Beads | GitHub | Files |
|---------|-----|-------|--------|-------|
| Real-time data | ✓ | - | ✓ | - |
| Works offline | - | ✓ | - | ✓ |
| Dependency tracking | ✓ | ✓ | - | - |
| Linear integration | ✓ | - | - | - |
| No setup required | ✓ | - | - | ✓ |
| Write access | - | ✓ | ✓ | ✓ |

## Next Steps

- See [API Client README](./api-client.README.md) for full API documentation
- Check [Worker API](../../worker/src/api/issues.ts) for endpoint details
- Read [Compiler docs](./compiler.ts) for integration details
