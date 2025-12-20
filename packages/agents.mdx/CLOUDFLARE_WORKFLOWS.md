# Cloudflare Workflows Integration

This document explains how agents.mdx integrates with Cloudflare Workflows for durable, long-running workflow execution.

## Overview

Cloudflare Workflows enable autonomous development by:

1. **Durable execution** - Workflows survive worker restarts
2. **Long waits** - Can pause for days/weeks waiting for PR approval
3. **Automatic retries** - Failed API calls retry with exponential backoff
4. **Event-driven** - Resume workflows when external events occur

## Architecture

```
GitHub Webhook
      │
      ▼
┌─────────────────────────────────────────┐
│         todo.mdx Worker                 │
│                                         │
│  handleIssueReady()                     │
│        │                                │
│        ▼                                │
│  ┌──────────────────────────────────┐  │
│  │  DevelopWorkflow                 │  │
│  │  (Cloudflare Workflow)           │  │
│  │                                  │  │
│  │  1. claude.do() ──> step.do()   │  │
│  │  2. pr.create() ──> step.do()   │  │
│  │  3. waitForApproval() ──────────┼──┼──> step.waitForEvent()
│  │                                  │  │        │ (paused)
│  │                                  │  │        │
│  │                                  │  │        │ PR approved
│  │                                  │  │        ▼
│  │  4. pr.merge() ──> step.do()    │  │  (resumed)
│  │  5. issues.close() ──> step.do()│  │
│  └──────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

## Key Components

### 1. Durable Transport (`cloudflare-workflows.ts`)

Wraps cloud transport with Workflows durability:

```typescript
import { durableTransport } from 'agents.mdx/cloudflare-workflows'

const transport = durableTransport(step, {
  repo,
  payloadBinding: env.PAYLOAD,
  installationId: event.payload.installationId,
})
```

**Features:**
- Every `transport.call()` wrapped in `step.do()` for automatic retries
- `pr.waitForApproval()` uses `step.waitForEvent()` to pause execution
- Step names include issue ID for debugging in Workflows dashboard

### 2. Workflow Class (`worker/src/workflows/develop.ts`)

Cloudflare Workflow that implements the development cycle:

```typescript
export class DevelopWorkflow extends Workflow {
  async run(event: WorkflowEvent, step: WorkflowStep) {
    const runtime = createRuntime({
      repo: event.payload.repo,
      transport: durableTransport(step, config)
    })

    // All calls are now durable!
    await runtime.claude.do({ task: issue.title })
    const pr = await runtime.pr.create({ ... })
    await runtime.pr.waitForApproval(pr) // Pauses here
    await runtime.pr.merge(pr)
  }
}
```

**Flow:**
1. Update issue to `in_progress`
2. Spawn Claude to implement (durable)
3. Create PR (durable)
4. Request code review from Claude (durable)
5. Wait for PR approval (pauses workflow)
6. Merge PR (durable)
7. Close issue (durable)

### 3. Webhook Handlers (`worker/src/workflows/webhook-handlers.ts`)

Trigger workflows and send events:

```typescript
import { handleIssueReady, handlePRApproval } from './workflows/webhook-handlers'

// When issue becomes ready
const instance = await handleIssueReady(env, issue, repo, installationId)

// When PR is approved
await handlePRApproval(env, pr, reviewer)
```

## Usage

### 1. Configure Worker Bindings

`wrangler.toml`:

```toml
[[workflows]]
binding = "DEVELOP_WORKFLOW"
name = "develop-workflow"
class_name = "DevelopWorkflow"
```

### 2. Export Workflow from Worker

`worker/src/index.ts`:

```typescript
export { DevelopWorkflow } from './workflows/develop'
```

### 3. Trigger Workflow

```typescript
// When issue becomes ready (via webhook or beads daemon)
app.post('/api/workflows/issue/ready', async (c) => {
  const { issue, repo, installationId } = await c.req.json()

  const instance = await c.env.DEVELOP_WORKFLOW.create({
    id: `develop-${issue.id}`,
    params: { repo, issue, installationId }
  })

  return c.json({ workflowId: instance.id })
})
```

### 4. Send Events to Paused Workflows

```typescript
// When GitHub PR is approved
app.post('/github/webhook', async (c) => {
  const payload = await c.req.json()

  if (payload.action === 'submitted' && payload.review.state === 'approved') {
    // Extract issue ID from PR body
    const issueId = extractIssueId(payload.pull_request.body)
    const workflowId = `develop-${issueId}`

    // Workflow will resume automatically when event is sent
    // (Implementation depends on Workflows event API)
  }
})
```

## How It Works

### Step.do() - Automatic Retries

Every API call is wrapped in `step.do()`:

```typescript
// Before (cloud.ts)
async call(method, args) {
  switch (namespace) {
    case 'claude':
      return callClaude(binding, action, args)
  }
}

// After (cloudflare-workflows.ts)
async call(method, args) {
  switch (namespace) {
    case 'claude':
      return step.do(`claude.${action}`, () =>
        callClaude(binding, action, args)
      )
  }
}
```

If `callClaude()` throws, Workflows automatically retries with exponential backoff.

### Step.waitForEvent() - Long Pauses

Special handling for `pr.waitForApproval()`:

```typescript
// In durableTransport
if (method === 'pr.waitForApproval') {
  const pr = args[0] as PR

  return step.waitForEvent(`pr.${pr.number}.approved`, {
    timeout: '7d',
    timeoutError: new Error('PR approval timeout')
  })
}
```

**What happens:**
1. Workflow pauses at `waitForEvent()`
2. Worker can be restarted, scaled down, etc.
3. When PR approved, webhook sends event
4. Workflow resumes from exact point

### Event Names

Helper functions generate consistent event names:

```typescript
import { prApprovalEvent, issueReadyEvent } from 'agents.mdx/cloudflare-workflows'

const eventName = prApprovalEvent(pr) // "pr.123.approved"
```

## Configuration

### DurableTransportConfig

```typescript
interface DurableTransportConfig {
  // Required (from CloudTransportConfig)
  repo: Repo
  payloadBinding?: Service<PayloadRPC>
  claudeBinding?: Service<ClaudeSandbox>
  installationId?: number
  apiBaseUrl?: string

  // Cloudflare Workflows specific
  stepPrefix?: string // Prefix for step names (default: '')
  useDurableSteps?: boolean // Use step.do (default: true)
  eventNames?: {
    prApproval?: (pr: PR) => string // Custom event naming
  }
}
```

### Example: Custom Event Names

```typescript
const transport = durableTransport(step, {
  repo,
  installationId,
  eventNames: {
    prApproval: (pr) => `repo.${repo.name}.pr.${pr.number}.approved`
  }
})
```

## Testing

Disable durability for testing:

```typescript
const transport = durableTransport(step, {
  repo,
  useDurableSteps: false // Skip step.do() wrapping
})
```

## Example: Full Development Cycle

```typescript
// 1. Issue becomes ready (dependency closed)
// Webhook: /api/beads/sync
await handleIssueReady(env, issue, repo, installationId)

// 2. Workflow starts
// - Updates issue to in_progress
// - Spawns Claude (step.do)
// - Creates PR (step.do)
// - Requests review (step.do)
// - Waits for approval (step.waitForEvent - PAUSED)

// 3. Hours/days later: Human approves PR
// Webhook: /github/webhook (pull_request_review)
await handlePRApproval(env, pr, reviewer)

// 4. Workflow resumes
// - Merges PR (step.do)
// - Closes issue (step.do)
// - Dependent issues unblock
// - New workflows start for unblocked issues
```

## Benefits

### Before Workflows

```typescript
// Polling-based (wasteful)
while (!pr.approved) {
  await sleep(60000) // Check every minute
  const status = await github.getPR(pr.number)
  if (status.reviews.some(r => r.state === 'approved')) break
}
```

**Problems:**
- Wastes CPU checking every minute
- Can't survive worker restart
- Timeout limits (max a few minutes)

### After Workflows

```typescript
// Event-based (efficient)
await pr.waitForApproval(pr, { timeout: '7d' })
```

**Benefits:**
- No resources used while waiting
- Can wait 7 days without timeout
- Survives worker restarts
- Resumes exactly where it left off

## Advanced Usage

### Multiple Workflows

```typescript
// Epic workflow - waits for all children
export class EpicWorkflow extends Workflow {
  async run(event, step) {
    const runtime = createRuntime({
      repo: event.payload.repo,
      transport: durableTransport(step, config)
    })

    const epic = event.payload.epic
    const children = await runtime.epics.children(epic.id)

    // Wait for all children to complete
    for (const child of children) {
      await step.waitForEvent(`issue.${child.id}.closed`, {
        timeout: '30d'
      })
    }

    // All children done, close epic
    await runtime.issues.close(epic.id)
  }
}
```

### Parallel Execution

```typescript
// Run multiple steps in parallel
const [diff, context] = await Promise.all([
  step.do('claude-implement', () =>
    runtime.claude.do({ task: issue.title })
  ),
  step.do('fetch-context', () =>
    runtime.todo.render()
  )
])
```

### Error Handling

```typescript
try {
  await runtime.pr.merge(pr)
} catch (error) {
  // Update issue to blocked
  await runtime.issues.update(issue.id, {
    status: 'blocked',
    notes: `Merge failed: ${error.message}`
  })

  // Notify via Slack
  await runtime.slack.notify('#dev', `⚠️ Merge failed: ${issue.title}`)

  throw error // Workflow will retry
}
```

## Migration Path

1. **Phase 1 (current):** Implement durableTransport and DevelopWorkflow
2. **Phase 2:** Add GitHub webhook integration for PR approvals
3. **Phase 3:** Create additional workflows (Epic, Review, etc.)
4. **Phase 4:** Deploy to production with real repos

## References

- [Cloudflare Workflows Docs](https://developers.cloudflare.com/workflows/)
- [agents.mdx Documentation](./README.md)
- [Workflow Examples](../../docs/agents-workflows.mdx)
