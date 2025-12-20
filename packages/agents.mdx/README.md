# agents.mdx

Proxy runtime for workflow orchestration - abstracts local vs cloud execution.

## Features

- **Workflow Daemon**: Watch `.workflows/*.mdx` files and execute handlers on beads events
- **Template Literal API**: Clean syntax for common operations
- **Local Transport**: Routes to CLI tools (claude, git, bd, gh)
- **Cloud Transport**: Routes to Cloudflare Workers and Durable Objects
- **Hot Reload**: Automatically reloads workflows when files change

## Installation

```bash
pnpm add agents.mdx
```

Optional peer dependency for local workflow execution:

```bash
pnpm add beads-workflows
```

## CLI Usage

### Start Workflow Daemon

Monitor `.workflows/*.mdx` files and execute handlers when beads events fire:

```bash
# Auto-detect repository from git
agents.mdx watch

# Specify repository explicitly
agents.mdx watch --repo dot-do/todo.mdx

# Enable debug logging
agents.mdx watch --debug

# Custom directories
agents.mdx watch --workflows .workflows --beads .beads
```

### Authentication

```bash
# Authenticate via oauth.do
agents.mdx auth

# Check authentication status
agents.mdx status

# Logout
agents.mdx logout
```

## Programmatic Usage

### Creating a Runtime

```typescript
import { createRuntime, localTransport } from 'agents.mdx'

const runtime = createRuntime({
  repo: {
    owner: 'dot-do',
    name: 'todo.mdx',
    defaultBranch: 'main',
    url: 'https://github.com/dot-do/todo.mdx'
  },
  transport: localTransport({
    repo: { ... },
    cwd: process.cwd()
  })
})

// Use template literal API
await runtime.claude.do`implement ${feature}`
await runtime.git.commit('feat: add new feature')
await runtime.pr.create({ branch: 'feature', title: 'Add feature', body: '...' })
```

### Starting the Daemon

```typescript
import { startDaemon } from 'agents.mdx'

const daemon = await startDaemon({
  repo: {
    owner: 'dot-do',
    name: 'todo.mdx',
    defaultBranch: 'main',
    url: 'https://github.com/dot-do/todo.mdx'
  },
  workflowsDir: '.workflows',
  beadsDir: '.beads',
  cwd: process.cwd(),
  debug: true
})

// daemon.isRunning() => true
// daemon.getWorkflows() => ActiveWorkflow[]

await daemon.stop()
```

## Writing Workflows

Create `.workflows/*.mdx` files with TypeScript code blocks:

### Example: Auto-Assign Ready Issues

```mdx
---
name: auto-assign
description: Automatically assign ready issues to claude
enabled: true
---

# Auto Assign Workflow

```typescript
// When an issue becomes ready (unblocked)
on.issue.ready(async (issue) => {
  // Update issue to in_progress and assign to claude
  await issues.update(issue.id, {
    status: 'in_progress',
    assignee: 'claude',
  })

  console.log(`Assigned ${issue.id} to claude`)
})
\```
```

### Event Handlers

```typescript
// Issue events
on.issue.created(async (issue, runtime) => { ... })
on.issue.updated(async (issue, runtime) => { ... })
on.issue.ready(async (issue, runtime) => { ... })
on.issue.closed(async (issue, runtime) => { ... })

// Epic events
on.epic.completed(async (epic, children, runtime) => { ... })

// Schedule handlers
every.day('9am', async (runtime) => { ... })
every.hour(async (runtime) => { ... })
every.week('monday', '9am', async (runtime) => { ... })
```

### Runtime API

Available in all workflow handlers:

```typescript
// Claude API (template literals or structured)
await claude.do`implement ${feature}`
await claude.do({ task: 'implement feature', context: 'additional info' })

await claude.research`how does ${technology} work?`
await claude.review({ pr: pullRequest, focus: ['security', 'performance'] })
await claude.ask`what is the best way to ${question}?`

// Git operations
await git.commit('message')
await git.push('branch')
await git.branch('feature-name')
await git.checkout('main')
await git.worktree.create('feature-name')

// Issue management
const ready = await issues.ready()
const issue = await issues.show('todo-123')
await issues.update('todo-123', { status: 'in_progress' })
await issues.close('todo-123', 'completed')

// PR management
const pr = await pr.create({
  branch: 'feature',
  title: 'Add feature',
  body: 'Description'
})
await pr.waitForApproval(pr)
await pr.merge(pr)

// Epic tracking
const epics = await epics.list()
const progress = await epics.progress('epic-id')

// Repository context
console.log(repo.owner, repo.name) // Available in all handlers
console.log(issue.id, issue.title) // Available in issue handlers
```

## Architecture

```
.workflows/*.mdx
      │ parsed by parser.ts
      ▼
┌─────────────────┐
│ Compiled        │
│ Workflows       │ compiler.ts
└────────┬────────┘
         │ registered with
         ▼
┌─────────────────┐
│ Daemon          │
│                 │
│ - File watcher  │
│ - Beads events  │ daemon.ts
│ - Executor      │
└────────┬────────┘
         │ uses
         ▼
┌─────────────────┐
│ Runtime         │
│                 │
│ - Proxy API     │ runtime.ts
│ - Transport     │
└────────┬────────┘
         │ routes via
         ▼
┌─────────────────┐
│ Transport       │
│                 │
│ Local:          │
│ - claude CLI    │
│ - git CLI       │
│ - bd CLI        │ local.ts
│ - gh API        │
│                 │
│ Cloud:          │
│ - Worker RPC    │
│ - DO bindings   │ cloud.ts
└─────────────────┘
```

## Development

```bash
# Type check
pnpm typecheck

# Build
pnpm build

# Watch mode
pnpm dev

# Test
pnpm test
```

## License

MIT
