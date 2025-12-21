# Sandbox Stdio over WebSocket Architecture

> **Status:** Design
> **Epic:** `todo-nsd`
> **Author:** Claude
> **Date:** 2025-12-20

## Overview

This document describes the architecture for a unified stdio mirroring system over WebSockets that enables both CLI and browser clients to interact with processes running inside Cloudflare Sandbox containers.

### Goals

1. **Unified Protocol** - Single wire protocol serves both CLI (`sbx-stdio`) and browser (xterm.js) clients
2. **Low Latency** - Binary protocol minimizes overhead for interactive terminal use
3. **Secure** - oauth.do authentication for all connections
4. **Extensible** - Foundation for PTY support, shared sessions, and multi-pane terminals

### Non-Goals

- Full PTY support (future enhancement, see `todo-2qq7`)
- Session persistence/reconnection (handled by `todo-wko`)
- Multi-user shared sessions (handled by `todo-1u3`)

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
│                                                                              │
│   ┌─────────────────────────┐           ┌─────────────────────────────────┐ │
│   │      Bun CLI            │           │         Browser                 │ │
│   │     (sbx-stdio)         │           │                                 │ │
│   │                         │           │  ┌───────────────────────────┐  │ │
│   │  - Raw mode stdin       │           │  │  xterm.js + React         │  │ │
│   │  - Binary WS messages   │           │  │                           │  │ │
│   │  - Ctrl+] to exit       │           │  │  - Terminal emulation     │  │ │
│   │  - oauth.do token       │           │  │  - ArrayBuffer handling   │  │ │
│   │                         │           │  │  - Resize events          │  │ │
│   └───────────┬─────────────┘           │  └─────────────┬─────────────┘  │ │
│               │                         │                │                 │ │
│               │ wss://                  │                │ wss://          │ │
│               │                         └────────────────┼─────────────────┘ │
└───────────────┼──────────────────────────────────────────┼───────────────────┘
                │                                          │
                └─────────────────┬────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE WORKER                                    │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        WebSocket Handler                             │   │
│   │                                                                      │   │
│   │  1. Check Upgrade: websocket header                                  │   │
│   │  2. Validate oauth.do token                                          │   │
│   │  3. Extract sandbox ID, cmd, args from query params                  │   │
│   │  4. Proxy via sandbox.wsConnect(request, 8080)                       │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                  │                                           │
│                                  │ sandbox.wsConnect()                       │
│                                  ▼                                           │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     Sandbox Durable Object                           │   │
│   │                                                                      │   │
│   │  - Manages sandbox lifecycle                                         │   │
│   │  - Routes WebSocket to container port 8080                           │   │
│   │  - Handles sandbox creation/termination                              │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CLOUDFLARE SANDBOX CONTAINER                            │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    stdio-ws.ts (Bun WebSocket Server)                │   │
│   │                         Listening on 0.0.0.0:8080                    │   │
│   │                                                                      │   │
│   │   ┌─────────────────────────────────────────────────────────────┐   │   │
│   │   │                    WebSocket Connection                      │   │   │
│   │   │                                                              │   │   │
│   │   │  on:open   → Parse ?cmd=, ?arg= → Bun.spawn([cmd, ...args]) │   │   │
│   │   │  on:message (binary) → write to child.stdin                  │   │   │
│   │   │  on:message (JSON)   → handle resize/signal                  │   │   │
│   │   │  on:close  → child.kill('SIGTERM')                           │   │   │
│   │   │                                                              │   │   │
│   │   └──────────────────────────┬──────────────────────────────────┘   │   │
│   │                              │                                       │   │
│   │                              ▼                                       │   │
│   │   ┌─────────────────────────────────────────────────────────────┐   │   │
│   │   │                     Child Process                            │   │   │
│   │   │                                                              │   │   │
│   │   │   stdin  ←─── binary WS messages                             │   │   │
│   │   │   stdout ───→ pack(0x01, chunk) → WS binary                  │   │   │
│   │   │   stderr ───→ pack(0x02, chunk) → WS binary                  │   │   │
│   │   │   exit   ───→ { type: 'exit', code } → WS JSON               │   │   │
│   │   │                                                              │   │   │
│   │   └─────────────────────────────────────────────────────────────┘   │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    SDK Control Plane (dist/index.js)                 │   │
│   │                    (Required for Sandbox SDK APIs)                   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Wire Protocol

### Design Principles

1. **Binary-first** - Minimize parsing overhead for high-throughput scenarios
2. **Stream multiplexing** - Single connection carries stdout + stderr
3. **Control channel** - JSON text messages for metadata (resize, signals, exit)
4. **Symmetric** - Same protocol for CLI and browser

### Message Types

#### Client → Server

| Type | Format | Description |
|------|--------|-------------|
| **stdin** | Binary (raw bytes) | Written directly to child process stdin |
| **resize** | JSON `{ type: 'resize', cols: number, rows: number }` | Terminal dimensions changed |
| **signal** | JSON `{ type: 'signal', signal: string }` | Send signal to child (e.g., 'SIGINT') |

#### Server → Client

| Type | Format | Description |
|------|--------|-------------|
| **stdout** | Binary `0x01` + payload | Child process stdout |
| **stderr** | Binary `0x02` + payload | Child process stderr |
| **exit** | JSON `{ type: 'exit', code: number }` | Child process exited |

### Binary Frame Format

```
┌─────────┬──────────────────────────────────┐
│ Stream  │            Payload               │
│  ID     │          (raw bytes)             │
│ (1 byte)│         (N bytes)                │
└─────────┴──────────────────────────────────┘

Stream IDs:
  0x01 = stdout
  0x02 = stderr
```

### Protocol Implementation

```typescript
// packages/sandbox-stdio/src/protocol.ts

export const STREAM_STDOUT = 0x01;
export const STREAM_STDERR = 0x02;

// Control message types
export interface ResizeMessage {
  type: 'resize';
  cols: number;
  rows: number;
}

export interface SignalMessage {
  type: 'signal';
  signal: string;
}

export interface ExitMessage {
  type: 'exit';
  code: number;
}

export type ControlMessage = ResizeMessage | SignalMessage | ExitMessage;

// Pack output with stream ID
export function pack(streamId: number, chunk: Uint8Array): Uint8Array {
  const out = new Uint8Array(1 + chunk.byteLength);
  out[0] = streamId;
  out.set(chunk, 1);
  return out;
}

// Unpack stream ID from output
export function unpack(data: Uint8Array): { streamId: number; payload: Uint8Array } {
  return {
    streamId: data[0],
    payload: data.subarray(1)
  };
}

// Type guard for control messages
export function isControlMessage(data: unknown): data is ControlMessage {
  return typeof data === 'object' && data !== null && 'type' in data;
}

// Parse message (handles both binary and JSON)
export function parseMessage(data: string | ArrayBuffer):
  | { kind: 'binary'; streamId: number; payload: Uint8Array }
  | { kind: 'control'; message: ControlMessage }
  | { kind: 'stdin'; data: Uint8Array } {

  if (typeof data === 'string') {
    const parsed = JSON.parse(data);
    if (isControlMessage(parsed)) {
      return { kind: 'control', message: parsed };
    }
    throw new Error('Unknown control message');
  }

  const bytes = new Uint8Array(data);
  const { streamId, payload } = unpack(bytes);
  return { kind: 'binary', streamId, payload };
}
```

## Component Specifications

### 1. Sandbox Server (`stdio-ws.ts`)

**Location:** `sandbox/stdio-ws.ts`
**Runs on:** `0.0.0.0:8080` inside sandbox container
**Issue:** `todo-e1g`

```typescript
// sandbox/stdio-ws.ts
import { pack, STREAM_STDOUT, STREAM_STDERR } from '@todo.mdx/sandbox-stdio/protocol';

type WsData = {
  cmd: string;
  args: string[];
  proc?: ReturnType<typeof Bun.spawn>;
};

Bun.serve<WsData>({
  port: 8080,
  hostname: '0.0.0.0',

  fetch(req, server) {
    const url = new URL(req.url);
    const cmd = url.searchParams.get('cmd') ?? 'bash';
    const args = url.searchParams.getAll('arg');

    if (server.upgrade(req, { data: { cmd, args } })) return;
    return new Response('stdio-ws bridge\n');
  },

  websocket: {
    open(ws) {
      const { cmd, args } = ws.data;

      const proc = Bun.spawn([cmd, ...args], {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
      });

      ws.data.proc = proc;

      // Pump stdout
      void pumpStream(ws, STREAM_STDOUT, proc.stdout);

      // Pump stderr
      void pumpStream(ws, STREAM_STDERR, proc.stderr);

      // Handle exit
      void (async () => {
        const code = await proc.exited;
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'exit', code }));
          ws.close();
        }
      })();
    },

    message(ws, msg) {
      const proc = ws.data.proc;
      if (!proc) return;

      // JSON control messages
      if (typeof msg === 'string') {
        try {
          const parsed = JSON.parse(msg);
          if (parsed?.type === 'signal') {
            proc.kill(parsed.signal);
          }
          // resize ignored in pipe mode (relevant for PTY)
        } catch {}
        return;
      }

      // Binary: write to stdin
      proc.stdin.write(msg);
      proc.stdin.flush();
    },

    close(ws) {
      try {
        ws.data.proc?.kill('SIGTERM');
      } catch {}
    },
  },
});

async function pumpStream(
  ws: ServerWebSocket<WsData>,
  streamId: number,
  stream?: ReadableStream<Uint8Array>
) {
  if (!stream) return;
  try {
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      if (ws.readyState !== ws.OPEN) break;
      ws.send(pack(streamId, chunk));
    }
  } catch {}
}
```

### 2. Worker Proxy

**Location:** `worker/src/sandbox/stdio.ts`
**Issue:** `todo-mqg`

```typescript
// worker/src/sandbox/stdio.ts
import { getSandbox } from '@cloudflare/sandbox';
import { verifyToken } from 'oauth.do/worker';

interface Env {
  Sandbox: DurableObjectNamespace;
  OAUTH_ISSUER: string;
}

export async function handleStdioWebSocket(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);

  // 1. Verify oauth.do token
  const token = url.searchParams.get('token')
    ?? request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    await verifyToken(token, { issuer: env.OAUTH_ISSUER });
  } catch {
    return new Response('Invalid token', { status: 401 });
  }

  // 2. Get sandbox ID
  const sandboxId = url.searchParams.get('sandbox') ?? 'default';

  // 3. Proxy to sandbox port 8080
  const sandbox = getSandbox(env.Sandbox, sandboxId);
  return await sandbox.wsConnect(request, 8080);
}

// Integration with main worker
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const upgrade = request.headers.get('Upgrade')?.toLowerCase();

    if (upgrade === 'websocket') {
      return handleStdioWebSocket(request, env);
    }

    return new Response('ok\n');
  },
};
```

### 3. Bun CLI Client (`sbx-stdio`)

**Location:** `packages/sbx-cli/src/index.ts`
**Issue:** `todo-r1i`

```typescript
#!/usr/bin/env bun
// packages/sbx-cli/src/index.ts

import { unpack, STREAM_STDOUT, STREAM_STDERR } from '@todo.mdx/sandbox-stdio/protocol';
import { ensureLoggedIn } from 'oauth.do/node';

interface Args {
  workerUrl: string;
  sandbox: string;
  cmd: string;
  args: string[];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Get oauth.do token
  const { token } = await ensureLoggedIn({
    clientId: process.env.OAUTH_CLIENT_ID!,
    scopes: ['sandbox:connect'],
  });

  // Build WebSocket URL
  const url = buildWsUrl(args, token);

  // Connect
  const ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';

  let exitCode: number | null = null;

  // Enable raw mode for TTY
  if (process.stdin.isTTY) {
    (process.stdin as any).setRawMode(true);
  }
  process.stdin.resume();

  ws.onopen = () => {
    // Forward stdin to WS
    process.stdin.on('data', (chunk: Buffer) => {
      // Ctrl+] to exit (like telnet)
      if (chunk.length === 1 && chunk[0] === 0x1d) {
        ws.close();
        return;
      }
      ws.send(chunk);
    });

    // Send initial resize
    sendResize(ws);
    process.stdout.on('resize', () => sendResize(ws));
  };

  ws.onmessage = (ev) => {
    if (typeof ev.data === 'string') {
      // JSON control message
      const msg = JSON.parse(ev.data);
      if (msg.type === 'exit') {
        exitCode = msg.code;
        ws.close();
      }
      return;
    }

    // Binary: demux by stream ID
    const { streamId, payload } = unpack(new Uint8Array(ev.data));

    if (streamId === STREAM_STDOUT) {
      process.stdout.write(payload);
    } else if (streamId === STREAM_STDERR) {
      process.stderr.write(payload);
    }
  };

  ws.onclose = () => {
    if (process.stdin.isTTY) {
      (process.stdin as any).setRawMode(false);
    }
    process.exit(exitCode ?? 0);
  };

  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
    process.exit(1);
  };
}

function sendResize(ws: WebSocket) {
  if (!process.stdout.isTTY) return;
  ws.send(JSON.stringify({
    type: 'resize',
    cols: process.stdout.columns ?? 80,
    rows: process.stdout.rows ?? 24,
  }));
}

function buildWsUrl(args: Args, token: string): string {
  const url = new URL(args.workerUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('sandbox', args.sandbox);
  url.searchParams.set('cmd', args.cmd);
  url.searchParams.set('token', token);
  for (const arg of args.args) {
    url.searchParams.append('arg', arg);
  }
  return url.toString();
}

function parseArgs(argv: string[]): Args {
  // ... argument parsing
}

main();
```

### 4. Browser Client (xterm.js)

**Location:** `packages/dashboard/src/components/Terminal.tsx`
**Issue:** `todo-5zv` (closed, existing)

```tsx
// packages/dashboard/src/components/Terminal.tsx
import { useEffect, useRef } from 'react';
import { Terminal as XTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { unpack, STREAM_STDOUT, STREAM_STDERR } from '@todo.mdx/sandbox-stdio/protocol';

interface TerminalProps {
  wsUrl: string;
  token: string;
  onExit?: (code: number) => void;
}

export function Terminal({ wsUrl, token, onExit }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize xterm.js
    const term = new XTerminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, monospace',
      theme: {
        background: '#1a1a2e',
        foreground: '#eaeaea',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;

    // Connect WebSocket
    const url = new URL(wsUrl);
    url.searchParams.set('token', token);

    const ws = new WebSocket(url.toString());
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      // Send resize
      ws.send(JSON.stringify({
        type: 'resize',
        cols: term.cols,
        rows: term.rows,
      }));
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'exit') {
          onExit?.(msg.code);
        }
        return;
      }

      // Binary output
      const { streamId, payload } = unpack(new Uint8Array(ev.data));

      // Write to terminal (both stdout and stderr go to same display)
      const text = new TextDecoder().decode(payload);
      term.write(text);
    };

    // Forward keystrokes
    term.onData((data) => {
      ws.send(new TextEncoder().encode(data));
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
      ws.send(JSON.stringify({
        type: 'resize',
        cols: term.cols,
        rows: term.rows,
      }));
    };

    window.addEventListener('resize', handleResize);
    term.onResize(handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      ws.close();
      term.dispose();
    };
  }, [wsUrl, token, onExit]);

  return <div ref={containerRef} className="h-full w-full" />;
}
```

## Authentication

### oauth.do Integration

**Issue:** `todo-qm7`

```
┌────────────────┐     ┌──────────────┐     ┌─────────────────┐
│   CLI/Browser  │────▶│   oauth.do   │────▶│  Worker Proxy   │
│                │     │              │     │                 │
│  1. Login flow │     │ 2. Issue JWT │     │ 3. Verify token │
│                │◀────│              │     │                 │
│  4. Use token  │─────┼──────────────┼────▶│ 5. Proxy to     │
│     in WS URL  │     │              │     │    sandbox      │
└────────────────┘     └──────────────┘     └─────────────────┘
```

### CLI Authentication Flow

```typescript
// Using oauth.do/node
import { ensureLoggedIn } from 'oauth.do/node';

const { token } = await ensureLoggedIn({
  clientId: 'sbx-cli',
  scopes: ['sandbox:connect', 'sandbox:exec'],
});

// Token passed in WebSocket URL
const ws = new WebSocket(`wss://worker.example/attach?token=${token}&sandbox=...`);
```

### Browser Authentication Flow

```typescript
// Using oauth.do/react
import { useAuth } from 'oauth.do/react';

function TerminalPage() {
  const { token, login, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <button onClick={login}>Login to access terminal</button>;
  }

  return <Terminal wsUrl={wsUrl} token={token} />;
}
```

## Container Setup

### Dockerfile

**Issue:** `todo-7ct`

```dockerfile
# sandbox/Dockerfile
FROM docker.io/cloudflare/sandbox:0.3.3

# Copy stdio bridge server
COPY stdio-ws.ts /workspace/stdio-ws.ts

# Copy startup script
COPY startup.sh /container-server/startup.sh
RUN chmod +x /container-server/startup.sh

# Pre-install common tools (optional)
RUN apt-get update && apt-get install -y \
    git \
    curl \
    vim \
    && rm -rf /var/lib/apt/lists/*
```

### Startup Script

```bash
#!/bin/bash
# sandbox/startup.sh
set -euo pipefail

# Start stdio WebSocket bridge in background
bun /workspace/stdio-ws.ts &

# Start SDK control plane (required for Sandbox SDK APIs)
exec bun dist/index.js
```

## Security Considerations

### Authentication

- All WebSocket connections require valid oauth.do token
- Tokens are validated by the Worker before proxying
- Scopes control access: `sandbox:connect`, `sandbox:exec`, `sandbox:admin`

### Sandbox Isolation

- Each sandbox runs in isolated container
- No shared state between sandboxes
- Network restricted (only allowed endpoints)
- Auto-terminate on disconnect/timeout

### Input Validation

- Command injection prevented by passing cmd/args separately
- Query params are sanitized before spawning
- Dangerous commands can be blocklisted

### Rate Limiting

- Connection rate limits per user
- Concurrent sandbox limits per account
- Bandwidth throttling for large outputs

## Future Enhancements

### PTY Support (`todo-2qq7`)

Replace pipe mode with PTY for full terminal support:

```typescript
// Future: PTY mode
import { spawn } from 'node-pty';

const pty = spawn(cmd, args, {
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  cwd: '/workspace',
});

// Resize becomes meaningful
ws.on('message', (msg) => {
  if (msg.type === 'resize') {
    pty.resize(msg.cols, msg.rows);
  }
});
```

### Session Persistence (`todo-wko`)

Use Durable Objects for reconnection:

```typescript
// Reconnect to existing session
const ws = new WebSocket(`wss://...?session=${sessionId}`);

// Server replays buffered output
// Then resumes live stream
```

### Shared Sessions (`todo-1u3`)

Multiple users in same sandbox:

```typescript
// User 1 creates session
const session = await createSession({ repo, task });

// User 2 joins
const ws = new WebSocket(`wss://...?session=${session.id}&role=viewer`);

// Both see same output
// Input controlled by mode (driver/viewer/collaborative)
```

### Multi-Pane via tmux (`todo-0ot`)

Run tmux inside sandbox:

```typescript
// Create tmux session
await sandbox.exec('tmux new-session -d -s main');

// Split panes
await sandbox.exec('tmux split-window -h');

// Route input to specific pane
ws.send({ type: 'stdin', pane: 'left', data: 'npm test\n' });
```

## Related Issues

### Core Implementation
- `todo-nsd` - Epic: Stdio Mirror over WebSockets
- `todo-42j` - Wire protocol types and constants
- `todo-e1g` - Sandbox stdio-ws.ts server
- `todo-7ct` - Dockerfile and startup script
- `todo-mqg` - Worker WebSocket proxy
- `todo-qm7` - oauth.do authentication
- `todo-r1i` - Bun CLI client (sbx-stdio)
- `todo-7s0` - CLI compilation and distribution

### Related Work (Existing)
- `todo-5zv` - xterm.js + React component (closed)
- `todo-wm0` - WebSocket endpoint for terminal (closed)
- `todo-42f` - Sandbox SDK integration (closed)

### Future Enhancements
- `todo-2qq7` - PTY support
- `todo-wko` - Session persistence with Durable Objects
- `todo-1u3` - Shared terminal sessions
- `todo-0ot` - tmux-based multi-pane terminal

## Appendix: CLI Usage Examples

```bash
# Interactive shell
sbx-stdio https://api.todo.mdx.do/attach \
  --sandbox user-123 \
  --cmd bash

# Run specific command
sbx-stdio https://api.todo.mdx.do/attach \
  --sandbox build-abc \
  --cmd bash \
  --arg -lc \
  --arg "npm test"

# With explicit token
sbx-stdio https://api.todo.mdx.do/attach \
  --sandbox dev \
  --cmd node \
  --arg script.js \
  --token eyJhbGciOiJSUzI1NiIs...

# Compile to standalone binary
bun build ./src/index.ts --compile --outfile sbx-stdio
```
