---
id: todo-wm0
title: "WebSocket endpoint for terminal session management"
state: closed
priority: 1
type: feature
labels: [terminal, websocket, worker]
---

# WebSocket endpoint for terminal session management

Create Worker endpoint that handles WebSocket upgrades and manages terminal sessions.

## Endpoint Design

### POST /api/terminal/session
Create a new terminal session, returns session ID.

### GET /api/terminal/:sessionId (WebSocket)
Upgrade to WebSocket for bidirectional terminal I/O.

## Implementation

```typescript
// worker/src/api/terminal.ts
import { Hono } from 'hono'

const terminal = new Hono<{ Bindings: Env }>()

// Create session
terminal.post('/session', async (c) => {
  const { repo, issueId, task } = await c.req.json()
  
  // Generate session ID
  const sessionId = crypto.randomUUID()
  
  // Store session config in KV or DO
  await c.env.TERMINAL_SESSIONS.put(sessionId, JSON.stringify({
    repo,
    issueId,
    task,
    createdAt: Date.now(),
    status: 'pending'
  }), { expirationTtl: 3600 })
  
  return c.json({ sessionId, wsUrl: `/api/terminal/${sessionId}` })
})

// WebSocket upgrade
terminal.get('/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')
  const upgradeHeader = c.req.header('Upgrade')
  
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket upgrade', 426)
  }
  
  // Get session config
  const session = await c.env.TERMINAL_SESSIONS.get(sessionId, 'json')
  if (!session) {
    return c.text('Session not found', 404)
  }
  
  // Create WebSocket pair
  const { 0: client, 1: server } = new WebSocketPair()
  server.accept()
  
  // Spawn sandbox and bridge I/O
  c.executionCtx.waitUntil(
    bridgeTerminalSession(c.env, server, session)
  )
  
  return new Response(null, {
    status: 101,
    webSocket: client,
  })
})

async function bridgeTerminalSession(
  env: Env,
  ws: WebSocket,
  session: TerminalSession
) {
  // Create sandbox
  const sandbox = await env.SANDBOX.create({
    // ... sandbox config
  })
  
  // Start Claude Code
  const stream = await sandbox.execStream(
    `claude-code --task "${session.task}"`,
    { pty: true }  // Enable PTY for full terminal support
  )
  
  // Bridge sandbox stdout → WebSocket
  const reader = stream.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const event = JSON.parse(value)
      ws.send(JSON.stringify({
        type: event.type,
        data: event.data
      }))
    }
  } finally {
    reader.releaseLock()
  }
  
  // Handle stdin from WebSocket
  ws.addEventListener('message', async (e) => {
    const msg = JSON.parse(e.data as string)
    if (msg.type === 'stdin') {
      await sandbox.stdin(msg.data)
    }
    if (msg.type === 'resize') {
      await sandbox.resize(msg.cols, msg.rows)
    }
  })
  
  ws.addEventListener('close', async () => {
    await sandbox.terminate()
  })
}

export { terminal }
```

## Session Management
- Track active sessions in KV or Durable Object
- Auto-cleanup stale sessions
- Support reconnection to existing sessions
- Rate limiting per user

### Related Issues

**Blocks:**
- **todo-1u3**: Shared terminal sessions: user + Claude in same sandbox
- **todo-g21**: Terminal session page in dashboard
- **todo-wko**: Terminal session persistence with Durable Objects

### Timeline

- **Created:** 12/20/2025

