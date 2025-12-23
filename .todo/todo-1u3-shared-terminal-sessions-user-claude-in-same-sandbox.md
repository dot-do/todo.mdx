---
id: todo-1u3
title: "Shared terminal sessions: user + Claude in same sandbox"
state: closed
priority: 2
type: feature
labels: ["collaboration", "sandbox", "terminal"]
createdAt: "2025-12-20T19:47:40.346Z"
updatedAt: "2025-12-23T10:08:49.119Z"
closedAt: "2025-12-23T10:08:49.119Z"
source: "beads"
---

# Shared terminal sessions: user + Claude in same sandbox

Enable collaborative terminal sessions where user and Claude Code share the same sandbox VM - user can test, use neovim, debug while Claude works or watches.

## Use Cases
1. **Watch & Takeover** - Watch Claude work, take control to test/debug, hand back
2. **Pair Programming** - Claude writes code, user runs tests in parallel
3. **Interactive Debugging** - User runs into issue, Claude joins to help
4. **Teaching** - User shows Claude how something works in the codebase

## Architecture Options

### Option A: Single PTY, Multiplexed Input
```
┌─────────────┐     ┌─────────────┐
│ User        │     │ Claude      │
│ Browser     │     │ Agent       │
└──────┬──────┘     └──────┬──────┘
       │ stdin             │ stdin
       └────────┬──────────┘
                ▼
         ┌──────────────┐
         │   Sandbox    │
         │  Single PTY  │
         │  /bin/bash   │
         └──────────────┘
                │ stdout (broadcast to both)
                ▼
```
- Both type to same shell
- Like tmux shared session
- Can be chaotic without coordination

### Option B: tmux Inside Sandbox
```
         ┌──────────────────────────────┐
         │         Sandbox              │
         │  ┌─────────────────────────┐ │
         │  │        tmux             │ │
         │  │  ┌───────┐ ┌──────────┐ │ │
         │  │  │ pane0 │ │  pane1   │ │ │
         │  │  │ user  │ │  claude  │ │ │
         │  │  └───────┘ └──────────┘ │ │
         │  └─────────────────────────┘ │
         └──────────────────────────────┘
```
- User and Claude get separate panes
- Can see each other's work
- Switch panes or work simultaneously
- tmux handles multiplexing natively

### Option C: Session Modes with Handoff
```typescript
type SessionMode = 
  | 'claude-driving'   // Claude has input, user watches
  | 'user-driving'     // User has input, Claude watches  
  | 'collaborative'    // Both can input (tmux-style)
  | 'paused'           // Neither active

interface SharedSession {
  mode: SessionMode
  activeActor: 'user' | 'claude' | 'both'
  handoffRequested?: 'user' | 'claude'
}
```

## Implementation Sketch

### Shared Session DO
```typescript
// worker/src/do/shared-terminal.ts
export class SharedTerminalDO extends DurableObject<Env> {
  private sandbox: Sandbox | null = null
  private userSocket: WebSocket | null = null
  private claudeSocket: WebSocket | null = null
  private mode: SessionMode = 'collaborative'

  async connectUser(request: Request) {
    const { 0: client, 1: server } = new WebSocketPair()
    server.accept()
    this.userSocket = server

    // User input → sandbox
    server.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data as string)
      if (msg.type === 'stdin' && this.canUserInput()) {
        this.sandbox?.stdin(msg.data)
      }
      if (msg.type === 'request-control') {
        this.handleHandoff('user')
      }
    })

    // Replay buffer
    this.replayBuffer(server)

    return new Response(null, { status: 101, webSocket: client })
  }

  async connectClaude(config: ClaudeConfig) {
    // Claude connects via internal API, not WebSocket
    // Or via special WebSocket endpoint

    // Claude's output also goes to sandbox stdin
    // Claude receives sandbox stdout to "see" what's happening
  }

  private broadcastOutput(data: string) {
    const msg = JSON.stringify({ type: 'stdout', data })
    this.userSocket?.send(msg)
    this.claudeSocket?.send(msg)
    this.outputBuffer.push(data)
  }

  private canUserInput(): boolean {
    return this.mode === 'user-driving' || this.mode === 'collaborative'
  }
}
```

### UI for Mode Switching
```tsx
function SharedTerminal({ sessionId }) {
  const [mode, setMode] = useState<SessionMode>('collaborative')

  return (
    <div className="h-screen flex flex-col">
      <header className="h-12 flex items-center px-4 gap-4">
        <ModeIndicator mode={mode} />
        
        <div className="flex gap-2">
          <Button 
            variant={mode === 'user-driving' ? 'default' : 'ghost'}
            onClick={() => requestMode('user-driving')}
          >
            👤 Take Control
          </Button>
          <Button
            variant={mode === 'claude-driving' ? 'default' : 'ghost'}
            onClick={() => requestMode('claude-driving')}
          >
            🤖 Let Claude Drive
          </Button>
          <Button
            variant={mode === 'collaborative' ? 'default' : 'ghost'}
            onClick={() => requestMode('collaborative')}
          >
            👥 Collaborative
          </Button>
        </div>
      </header>

      <Terminal wsUrl={`/api/shared-terminal/${sessionId}`} />
    </div>
  )
}
```

## tmux Integration (Recommended)

Best approach: run tmux in sandbox, expose via WebSocket.

```typescript
async function createSharedSession(env: Env, config: SessionConfig) {
  const sandbox = await env.SANDBOX.create({ ... })

  // Start tmux session
  await sandbox.exec('tmux new-session -d -s shared')
  
  // Create panes
  await sandbox.exec('tmux split-window -h -t shared')
  await sandbox.exec('tmux select-pane -t shared:0.0')  // Left = user
  await sandbox.exec('tmux select-pane -t shared:0.1')  // Right = claude

  // User connects to left pane
  // Claude agent connects to right pane
  // Both see full tmux session

  return sandbox
}
```

## Claude Agent Integration

Claude needs to:
1. Receive stdout from sandbox (see what user does)
2. Send stdin to sandbox (type commands)
3. Understand when to act vs watch
4. Respond to handoff requests

```typescript
// Claude's view of the shared session
interface ClaudeSessionInterface {
  // Observe
  onOutput(callback: (data: string) => void): void
  
  // Act
  type(text: string): Promise<void>
  
  // Coordinate
  requestControl(): Promise<void>
  yieldControl(): void
  
  // Context
  getMode(): SessionMode
  getRecentOutput(lines: number): string[]
}
```

## Security Considerations
- User can only connect to their own sessions
- Claude agent authenticated via internal token
- Rate limit input from both sources
- Audit log of who typed what

### Related Issues

**Depends on:**
- **todo-wm0**
- **todo-0ot**
- **todo-nsd**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/23/2025
- **Closed:** 12/23/2025
