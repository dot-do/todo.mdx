# Cloudflare Sandbox for Claude Code Execution

**Issue:** todo-6dj
**Date:** 2025-12-20
**Status:** Design Complete

## Overview

Spawn Claude Code agents in Cloudflare Sandbox for cloud-based execution. Clone repo, run agent, return diff. Supports both headless workflow execution and interactive browser-based terminal.

## Architecture

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│   Browser       │◄──────────────────►│  Cloudflare      │
│   xterm.js      │   stdin/stdout     │  Worker          │
│   React App     │                    │                  │
└─────────────────┘                    └────────┬─────────┘
                                                │ execStream()
                                                │ wsConnect()
                                       ┌────────▼─────────┐
                                       │  Sandbox SDK     │
                                       │  ┌─────────────┐ │
                                       │  │ Claude Code │ │
                                       │  │   (PTY)     │ │
                                       │  └─────────────┘ │
                                       └──────────────────┘
```

## Components

### 1. Dockerfile.claude

Container with Claude Code installed:

```dockerfile
FROM docker.io/cloudflare/sandbox:0.6.7
RUN npm install -g @anthropic-ai/claude-code
ENV COMMAND_TIMEOUT_MS=600000
EXPOSE 3000
```

### 2. ClaudeSandbox Durable Object

`worker/src/sandbox/claude.ts`

```typescript
import { Sandbox } from '@cloudflare/sandbox'

export class ClaudeSandbox extends Sandbox {
  // Start execution session
  async startSession(opts: {
    repo: string
    task: string
    context?: string
    installationId: number
  }): Promise<string>

  // Headless execution for workflows
  async execute(opts: {
    repo: string
    task: string
    context?: string
    installationId: number
  }): Promise<{
    diff: string
    summary: string
    filesChanged: string[]
  }>

  // Send feedback to running session
  async sendFeedback(sessionId: string, message: string): Promise<void>

  // Abort running session
  async abort(sessionId: string): Promise<void>

  // WebSocket handler for interactive mode
  async handleWebSocket(request: Request): Promise<Response>
}
```

### 3. Wrangler Configuration

Add to `worker/wrangler.jsonc`:

```jsonc
{
  "containers": [
    {
      "class_name": "ClaudeSandbox",
      "image": "./Dockerfile.claude",
      "instance_type": "basic"
    }
  ],
  "durable_objects": {
    "bindings": [
      // existing bindings...
      { "name": "CLAUDE_SANDBOX", "class_name": "ClaudeSandbox" }
    ]
  },
  "migrations": [
    // existing migrations...
    {
      "tag": "v3",
      "new_sqlite_classes": ["ClaudeSandbox"]
    }
  ]
}
```

### 4. Terminal WebSocket Endpoint

`worker/src/api/terminal.ts`

```typescript
app.get('/terminal/:sessionId', async (c) => {
  const upgradeHeader = c.req.header('Upgrade')
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket', 426)
  }

  const sessionId = c.req.param('sessionId')
  const doId = c.env.CLAUDE_SANDBOX.idFromName(sessionId)
  const sandbox = c.env.CLAUDE_SANDBOX.get(doId)

  return sandbox.handleWebSocket(c.req.raw)
})
```

### 5. agents.mdx Transport Integration

Update `packages/agents.mdx/src/cloudflare-workflows.ts`:

```typescript
async function callClaude(
  binding: DurableObjectNamespace,
  action: string,
  args: unknown[]
): Promise<unknown> {
  const [opts] = args as [DoOpts | ResearchOpts | ReviewOpts]

  // Get or create sandbox instance
  const id = binding.idFromName(`claude-${Date.now()}`)
  const sandbox = binding.get(id)

  switch (action) {
    case 'do':
      return sandbox.execute(opts as DoOpts)
    case 'research':
      return sandbox.research(opts as ResearchOpts)
    case 'review':
      return sandbox.review(opts as ReviewOpts)
    default:
      throw new Error(`Unknown Claude action: ${action}`)
  }
}
```

## Streaming Protocol

### SSE Events from Sandbox

```typescript
type SandboxEvent =
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'complete'; exitCode: number }
```

### Enhanced Events for Claude Code

```typescript
type ClaudeEvent =
  | SandboxEvent
  | { type: 'todo'; items: TodoItem[]; active?: string }
  | { type: 'plan'; steps: PlanStep[]; current?: number }
  | { type: 'file_change'; path: string; action: 'create' | 'modify' | 'delete' }
  | { type: 'awaiting_input'; prompt: string }
  | { type: 'result'; diff: string; summary: string; filesChanged: string[] }
```

## Two Modes of Operation

### 1. Headless (Workflow Mode)

Used by DevelopWorkflow for automated issue implementation:

```typescript
// In DevelopWorkflow
const result = await runtime.claude.do({
  task: issue.title,
  context: await runtime.todo.render()
})
// result = { diff, summary, filesChanged }
```

### 2. Interactive (Browser Mode)

User watches Claude work in real-time via xterm.js:

```typescript
// Browser
const ws = new WebSocket('wss://todo.mdx.do/terminal/session-123')
ws.onmessage = (e) => terminal.write(e.data)
terminal.onData((data) => ws.send(data))
```

## Security

1. **Token Isolation**: GitHub tokens fetched from WorkOS Vault at runtime, never exposed to sandbox
2. **Repo Scoping**: Sandbox only has access to the specific repo being worked on
3. **Network Isolation**: Sandbox network access controlled via capability security
4. **Session Isolation**: Each execution gets a fresh sandbox instance

## Testing

E2E tests should cover:

1. Headless execution - clone repo, run task, verify diff output
2. WebSocket connection - establish, receive output, send input
3. Feedback injection - interrupt Claude, provide guidance
4. Abort handling - stop execution cleanly
5. Error handling - invalid repo, missing tokens, timeout

## Implementation Order

1. Dockerfile.claude
2. ClaudeSandbox Durable Object (execute method)
3. Wrangler configuration
4. callClaude() transport integration
5. E2E tests for headless mode
6. WebSocket handler
7. Terminal API endpoint
8. E2E tests for interactive mode
