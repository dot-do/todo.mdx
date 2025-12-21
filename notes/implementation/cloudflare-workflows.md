# Cloudflare Workflows Integration - Implementation Summary

## Overview

Implemented Cloudflare Workflows integration for todo.mdx to enable durable, long-running autonomous development workflows. This allows workflows to:

- Survive worker restarts and deployments
- Wait days/weeks for PR approvals without holding resources
- Automatically retry failed API calls with exponential backoff
- Resume from exact point of failure

## What Was Implemented

### 1. Core Infrastructure

#### `packages/agents.mdx/src/cloudflare-workflows.ts`

**Purpose:** Durable transport wrapper that integrates agents.mdx runtime with Cloudflare Workflows.

**Key Features:**
- `durableTransport()` - Wraps every transport call in `step.do()` for automatic retries
- Special handling for `pr.waitForApproval()` using `step.waitForEvent()`
- Configurable step naming with issue ID prefix for debugging
- Event helper functions: `prApprovalEvent()`, `issueReadyEvent()`, `epicCompletedEvent()`

**API:**
```typescript
const transport = durableTransport(step, {
  repo,
  payloadBinding: env.PAYLOAD,
  claudeBinding: env.CLAUDE_SANDBOX,
  installationId,
  stepPrefix: issue.id, // Optional: prefix all steps
  useDurableSteps: true, // Can disable for testing
  eventNames: { // Custom event naming
    prApproval: (pr) => `pr.${pr.number}.approved`
  }
})
```

### 2. Worker Implementation

#### `worker/src/workflows/develop.ts`

**Purpose:** Complete development workflow implementation.

**Flow:**
1. Update issue to `in_progress`
2. Spawn Claude to implement the issue (durable via `step.do`)
3. Create PR with changes (durable)
4. Request code review from Claude (durable)
5. **Wait for PR approval** (pauses via `step.waitForEvent` - can wait days)
6. Merge PR (durable)
7. Close issue (durable)
8. Dependent issues unblock automatically

**Usage:**
```typescript
const instance = await env.DEVELOP_WORKFLOW.create({
  id: `develop-${issue.id}`,
  params: { repo, issue, installationId }
})
```

#### `worker/src/workflows/webhook-handlers.ts`

**Purpose:** Integration layer between webhooks and workflows.

**Functions:**
- `handleIssueReady()` - Trigger workflow when issue becomes unblocked
- `handlePRApproval()` - Send approval event to paused workflow
- `extractIssueId()` - Parse issue ID from PR body

#### `worker/src/workflows/example.ts`

**Purpose:** Example workflows showing different patterns.

**Includes:**
- `SimpleAutoDevWorkflow` - Minimal example
- `ProductionDevWorkflow` - Production-ready with error handling and retries

### 3. Configuration & Types

#### `worker/wrangler.toml`

Added Cloudflare Workflows binding:
```toml
[[workflows]]
binding = "DEVELOP_WORKFLOW"
name = "develop-workflow"
class_name = "DevelopWorkflow"
```

#### `worker/src/types.ts`

Added Workflow types:
```typescript
interface WorkflowNamespace {
  create<T>(options: { id: string; params: T }): Promise<WorkflowInstance<T>>
  get<T>(id: string): Promise<WorkflowInstance<T>>
}

interface WorkflowInstance<T> {
  id: string
  status: 'running' | 'complete' | 'failed' | 'paused'
  params: T
  pause(): Promise<void>
  resume(): Promise<void>
  terminate(): Promise<void>
}
```

#### `worker/src/types/cloudflare-workflows.d.ts`

Type declarations for `cloudflare:workflows` module:
- `Workflow<Env, Params>` - Base workflow class
- `WorkflowEvent<T>` - Event payload interface
- `WorkflowStep` - Durable step API (do, waitForEvent, sleep)

### 4. Package Updates

#### `packages/agents.mdx/src/index.ts`

Exported Cloudflare Workflows integration:
```typescript
export {
  durableTransport,
  prApprovalEvent,
  issueReadyEvent,
  epicCompletedEvent,
  type WorkflowStep,
  type WorkflowEvent,
  type DurableTransportConfig,
} from './cloudflare-workflows'
```

#### `packages/agents.mdx/package.json`

Added export path:
```json
{
  "exports": {
    "./cloudflare-workflows": {
      "types": "./dist/cloudflare-workflows.d.ts",
      "import": "./dist/cloudflare-workflows.js"
    }
  }
}
```

#### `worker/package.json`

Added agents.mdx dependency:
```json
{
  "dependencies": {
    "agents.mdx": "workspace:*"
  }
}
```

### 5. Documentation

#### `packages/agents.mdx/CLOUDFLARE_WORKFLOWS.md`

Comprehensive documentation covering:
- Architecture overview with diagrams
- How durability works (step.do, step.waitForEvent)
- Configuration options
- Usage examples
- Migration path
- Advanced patterns (error handling, parallel execution)

## How It Works

### Durable Execution with step.do()

**Before (cloud.ts):**
```typescript
async call(method, args) {
  return callClaude(binding, action, args) // Fails if API error
}
```

**After (cloudflare-workflows.ts):**
```typescript
async call(method, args) {
  return step.do(`claude.${action}`, () =>
    callClaude(binding, action, args) // Automatically retries on failure
  )
}
```

If `callClaude()` throws, Workflows automatically retries with exponential backoff.

### Long Waits with step.waitForEvent()

**Before (polling - wasteful):**
```typescript
while (!pr.approved) {
  await sleep(60000) // Check every minute
  const status = await github.getPR(pr.number)
}
```

**After (event-driven - efficient):**
```typescript
if (method === 'pr.waitForApproval') {
  return step.waitForEvent(`pr.${pr.number}.approved`, {
    timeout: '7d'
  })
}
```

Workflow pauses at `waitForEvent()`, uses zero resources while waiting, and resumes exactly where it left off when event is received.

## Integration Points

### 1. Triggering Workflows

```typescript
// When issue becomes ready
app.post('/api/workflows/issue/ready', async (c) => {
  const { issue, repo, installationId } = await c.req.json()

  const instance = await handleIssueReady(
    c.env,
    issue,
    repo,
    installationId
  )

  return c.json({ workflowId: instance.id })
})
```

### 2. Sending Events

```typescript
// When PR is approved
app.post('/github/webhook', async (c) => {
  const payload = await c.req.json()

  if (payload.review?.state === 'approved') {
    await handlePRApproval(c.env, pr, reviewer)
  }

  return c.json({ status: 'ok' })
})
```

## File Structure

```
packages/agents.mdx/
├── src/
│   ├── cloudflare-workflows.ts       # Durable transport implementation
│   └── index.ts                      # Export cloudflare-workflows
├── CLOUDFLARE_WORKFLOWS.md           # Comprehensive documentation
└── package.json                      # Add cloudflare-workflows export

worker/
├── src/
│   ├── workflows/
│   │   ├── develop.ts                # Main development workflow
│   │   ├── webhook-handlers.ts       # Integration layer
│   │   └── example.ts                # Example workflows
│   ├── types/
│   │   └── cloudflare-workflows.d.ts # Type declarations
│   ├── types.ts                      # Add WorkflowNamespace types
│   └── index.ts                      # Export DevelopWorkflow
├── wrangler.toml                     # Add workflow binding
└── package.json                      # Add agents.mdx dependency
```

## Benefits

### 1. Durability
- Workflows survive worker restarts/deployments
- Each step only executes once, even if workflow restarts
- Automatic retry with exponential backoff

### 2. Long Waits
- Can wait days/weeks for PR approvals
- Zero resource usage while waiting
- Resumes exactly where it left off

### 3. Observability
- Step names include issue ID for debugging
- Workflow dashboard shows execution progress
- Clear visibility into paused workflows

### 4. Reliability
- Automatic retries on transient failures
- Error handling with configurable retry limits
- Graceful degradation with status updates

## Next Steps

### Phase 1: Testing (Current)
- Test durableTransport with mock step object
- Verify step.do() wrapping for all namespaces
- Test step.waitForEvent() for PR approval

### Phase 2: Integration
- Implement GitHub webhook handlers for PR reviews
- Connect beads daemon to trigger workflows
- Add workflow status endpoints to API

### Phase 3: Production
- Deploy to staging environment
- Test with real repositories
- Monitor workflow execution in dashboard

### Phase 4: Expansion
- Implement EpicWorkflow (waits for all children)
- Add ReviewWorkflow (dedicated code review)
- Create ScheduledWorkflows (daily standup, cleanup)

## Testing

### Unit Tests

Test durable transport:
```typescript
// Mock WorkflowStep
const mockStep = {
  do: vi.fn((name, fn) => fn()),
  waitForEvent: vi.fn(() => Promise.resolve()),
  sleep: vi.fn(() => Promise.resolve()),
}

const transport = durableTransport(mockStep, config)

// Verify step.do() is called
await transport.call('claude.do', [{ task: 'test' }])
expect(mockStep.do).toHaveBeenCalledWith('claude.do', expect.any(Function))
```

### Integration Tests

Test workflow execution:
```typescript
// Create test workflow
const instance = await env.DEVELOP_WORKFLOW.create({
  id: 'test-workflow',
  params: { repo, issue, installationId }
})

// Verify workflow started
expect(instance.status).toBe('running')

// Send approval event
// (when implemented in Workflows API)

// Verify workflow completed
const completed = await env.DEVELOP_WORKFLOW.get('test-workflow')
expect(completed.status).toBe('complete')
```

## Key Insights

### 1. Proxy Pattern Enables Durability

The same runtime code works locally and in workflows:

```typescript
// Workflow code (unchanged)
await runtime.claude.do({ task: 'implement feature' })

// Local: runs CLI command
// Cloud: calls API via Workers RPC
// Workflows: wraps in step.do() for durability
```

### 2. Event-Driven > Polling

Waiting for PR approval:
- **Polling:** Check every minute, wastes CPU, timeout limits
- **Events:** Zero resources while waiting, can wait weeks

### 3. Step Names Matter

Including issue ID in step names:
- `todo-abc.claude.do` - Easy to find in dashboard
- `claude.do` - Which issue was this?

## References

- [Cloudflare Workflows Docs](https://developers.cloudflare.com/workflows/)
- [agents.mdx Documentation](./packages/agents.mdx/README.md)
- [Workflow Examples](./docs/agents-workflows.mdx)
- [Implementation Guide](./packages/agents.mdx/CLOUDFLARE_WORKFLOWS.md)

## Related Issues

- `todo-c2z` - Implement Cloudflare Workflows integration (this PR)
- Future: Implement webhook handlers for PR events
- Future: Connect beads daemon to trigger workflows
- Future: Add workflow status API endpoints
