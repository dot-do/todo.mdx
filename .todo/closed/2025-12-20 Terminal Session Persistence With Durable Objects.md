---
id: todo-wko
title: "Terminal session persistence with Durable Objects"
state: closed
priority: 2
type: feature
labels: ["durable-objects", "persistence", "terminal"]
createdAt: "2025-12-20T19:42:43.645Z"
updatedAt: "2025-12-23T10:08:49.119Z"
closedAt: "2025-12-23T10:08:49.119Z"
source: "beads"
dependsOn: ["todo-wm0", "todo-nsd"]
---

# Terminal session persistence with Durable Objects

Use Durable Objects to manage terminal session state for reconnection and history.

## Why Durable Objects?
- Persist session state across WebSocket reconnects
- Buffer output for late-joining viewers
- Store session history/logs
- Coordinate multiple viewers of same session

## Implementation

```typescript
// worker/src/do/terminal-session.ts
import { DurableObject } from 'cloudflare:workers'

interface SessionState {
  id: string
  repo: string
  task: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  createdAt: number
  outputBuffer: string[]  // Ring buffer of recent output
  viewers: Set<WebSocket>
}

export class TerminalSessionDO extends DurableObject<Env> {
  private state: SessionState | null = null
  private sandbox: Sandbox | null = null

  async fetch(request: Request) {
    const url = new URL(request.url)

    if (url.pathname === '/start') {
      return this.startSession(request)
    }

    if (url.pathname === '/connect') {
      return this.connectViewer(request)
    }

    if (url.pathname === '/status') {
      return Response.json(this.state)
    }

    return new Response('Not found', { status: 404 })
  }

  async startSession(request: Request) {
    const config = await request.json()
    
    this.state = {
      id: this.ctx.id.toString(),
      repo: config.repo,
      task: config.task,
      status: 'pending',
      createdAt: Date.now(),
      outputBuffer: [],
      viewers: new Set(),
    }

    // Persist to storage
    await this.ctx.storage.put('state', this.state)

    // Start sandbox in background
    this.ctx.waitUntil(this.runSandbox(config))

    return Response.json({ id: this.state.id })
  }

  async connectViewer(request: Request) {
    const { 0: client, 1: server } = new WebSocketPair()
    server.accept()

    // Send buffered output for replay
    for (const line of this.state?.outputBuffer || []) {
      server.send(JSON.stringify({ type: 'stdout', data: line }))
    }

    // Add to viewers
    this.state?.viewers.add(server)
    server.addEventListener('close', () => {
      this.state?.viewers.delete(server)
    })

    // Forward stdin to sandbox
    server.addEventListener('message', async (e) => {
      const msg = JSON.parse(e.data as string)
      if (msg.type === 'stdin' && this.sandbox) {
        await this.sandbox.stdin(msg.data)
      }
    })

    return new Response(null, { status: 101, webSocket: client })
  }

  private async runSandbox(config: any) {
    this.state!.status = 'running'
    
    // Create and run sandbox...
    // Broadcast output to all viewers
    // Buffer output for reconnecting viewers
  }

  private broadcast(message: any) {
    const data = JSON.stringify(message)
    
    // Buffer for replay
    this.state?.outputBuffer.push(message.data)
    if (this.state!.outputBuffer.length > 10000) {
      this.state!.outputBuffer.shift()
    }

    // Send to all viewers
    for (const ws of this.state?.viewers || []) {
      ws.send(data)
    }
  }
}
```

## Features
- Reconnect and see buffered output
- Multiple viewers for same session (pair programming)
- Session history stored in D1 after completion
- Graceful sandbox cleanup on DO hibernation

### Related Issues

**Depends on:**
- [todo-wm0](./todo-wm0.md)
- [todo-nsd](./todo-nsd.md)