/**
 * Stdio WebSocket Bridge for Cloudflare Sandbox
 *
 * Runs inside the sandbox container on port 8080.
 * Bridges WebSocket messages to child process stdin/stdout/stderr.
 *
 * Protocol:
 *   Client → Server:
 *     - Binary: raw bytes → child stdin
 *     - JSON: { type: 'resize', cols, rows } or { type: 'signal', signal }
 *
 *   Server → Client:
 *     - Binary: 0x01 + payload (stdout) or 0x02 + payload (stderr)
 *     - JSON: { type: 'exit', code }
 */

// Inline protocol constants (avoid external dependencies in sandbox)
const STREAM_STDOUT = 0x01;
const STREAM_STDERR = 0x02;

function pack(streamId: number, chunk: Uint8Array): Uint8Array {
  const out = new Uint8Array(1 + chunk.byteLength);
  out[0] = streamId;
  out.set(chunk, 1);
  return out;
}

// Types
interface WsData {
  cmd: string;
  args: string[];
  proc?: ReturnType<typeof Bun.spawn>;
}

interface ResizeMessage {
  type: 'resize';
  cols: number;
  rows: number;
}

interface SignalMessage {
  type: 'signal';
  signal: string;
}

type ControlMessage = ResizeMessage | SignalMessage;

function isControlMessage(data: unknown): data is ControlMessage {
  if (typeof data !== 'object' || data === null) return false;
  const msg = data as Record<string, unknown>;
  return msg.type === 'resize' || msg.type === 'signal';
}

/**
 * Pump a readable stream to WebSocket with stream ID prefix
 */
async function pumpStream(
  ws: Bun.ServerWebSocket<WsData>,
  streamId: number,
  stream?: ReadableStream<Uint8Array> | null
): Promise<void> {
  if (!stream) return;

  try {
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (ws.readyState !== 1) break; // 1 = OPEN

        ws.sendBinary(pack(streamId, value));
      }
    } finally {
      reader.releaseLock();
    }
  } catch (err) {
    // Connection may have closed, ignore errors
    console.error(`[stdio-ws] pump error for stream ${streamId}:`, err);
  }
}

// Default command and allowed commands (security)
const DEFAULT_CMD = 'bash';
const ALLOWED_COMMANDS = new Set([
  'bash',
  'sh',
  'zsh',
  'fish',
  'node',
  'bun',
  'python',
  'python3',
  'claude', // Claude Code CLI
  'claude-code',
  'npm',
  'pnpm',
  'yarn',
  'git',
  'make',
  'cargo',
  'go',
]);

function isCommandAllowed(cmd: string): boolean {
  // Allow if in whitelist or is an absolute path
  if (ALLOWED_COMMANDS.has(cmd)) return true;
  if (cmd.startsWith('/')) return true;
  if (cmd.startsWith('./')) return true;
  return false;
}

console.log('[stdio-ws] Starting WebSocket server on 0.0.0.0:8080');

Bun.serve<WsData>({
  port: 8080,
  hostname: '0.0.0.0',

  fetch(req, server) {
    const url = new URL(req.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response('ok\n', { status: 200 });
    }

    // Parse command from query params
    const cmd = url.searchParams.get('cmd') ?? DEFAULT_CMD;
    const args = url.searchParams.getAll('arg');

    // Validate command
    if (!isCommandAllowed(cmd)) {
      console.warn(`[stdio-ws] Blocked command: ${cmd}`);
      return new Response(`Command not allowed: ${cmd}\n`, { status: 403 });
    }

    // Attempt WebSocket upgrade
    const upgraded = server.upgrade(req, {
      data: { cmd, args },
    });

    if (upgraded) {
      console.log(`[stdio-ws] WebSocket upgrade: cmd=${cmd}, args=${args.join(' ')}`);
      return undefined;
    }

    // Non-WebSocket request
    return new Response(
      'Stdio WebSocket Bridge\n\n' +
      'Connect via WebSocket with optional query params:\n' +
      '  ?cmd=bash       Command to run (default: bash)\n' +
      '  ?arg=...        Arguments (repeatable)\n' +
      '\n' +
      'Example: wss://host:8080/?cmd=bash&arg=-l\n',
      {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      }
    );
  },

  websocket: {
    open(ws) {
      const { cmd, args } = ws.data;
      console.log(`[stdio-ws] Connection opened, spawning: ${cmd} ${args.join(' ')}`);

      try {
        const proc = Bun.spawn([cmd, ...args], {
          stdin: 'pipe',
          stdout: 'pipe',
          stderr: 'pipe',
          env: {
            ...process.env,
            TERM: process.env.TERM ?? 'xterm-256color',
            COLORTERM: 'truecolor',
            FORCE_COLOR: '1',
          },
        });

        ws.data.proc = proc;

        // Pump stdout to WebSocket
        void pumpStream(ws, STREAM_STDOUT, proc.stdout as ReadableStream<Uint8Array>);

        // Pump stderr to WebSocket
        void pumpStream(ws, STREAM_STDERR, proc.stderr as ReadableStream<Uint8Array>);

        // Handle process exit
        void (async () => {
          try {
            const code = await proc.exited;
            console.log(`[stdio-ws] Process exited with code ${code}`);

            if (ws.readyState === 1) {
              ws.send(JSON.stringify({ type: 'exit', code }));
              ws.close(1000, 'Process exited');
            }
          } catch (err) {
            console.error('[stdio-ws] Error waiting for process exit:', err);
          }
        })();
      } catch (err) {
        console.error('[stdio-ws] Failed to spawn process:', err);
        ws.send(JSON.stringify({ type: 'exit', code: 127 }));
        ws.close(1011, 'Failed to spawn process');
      }
    },

    message(ws, msg) {
      const proc = ws.data.proc;
      if (!proc) {
        console.warn('[stdio-ws] Received message but no process');
        return;
      }

      // Handle JSON control messages
      if (typeof msg === 'string') {
        try {
          const parsed = JSON.parse(msg);
          if (isControlMessage(parsed)) {
            if (parsed.type === 'signal') {
              console.log(`[stdio-ws] Sending signal: ${parsed.signal}`);
              try {
                proc.kill(parsed.signal as NodeJS.Signals);
              } catch (err) {
                console.error(`[stdio-ws] Failed to send signal:`, err);
              }
            } else if (parsed.type === 'resize') {
              // Resize is only meaningful for PTY mode
              // In pipe mode, we ignore it but log for debugging
              console.log(`[stdio-ws] Resize ignored (pipe mode): ${parsed.cols}x${parsed.rows}`);
            }
            return;
          }
        } catch {
          // Not valid JSON, treat as text input
        }

        // Text input → stdin
        const encoder = new TextEncoder();
        proc.stdin.write(encoder.encode(msg));
        proc.stdin.flush();
        return;
      }

      // Binary input → stdin
      if (msg instanceof ArrayBuffer || msg instanceof Uint8Array) {
        const data = msg instanceof ArrayBuffer ? new Uint8Array(msg) : msg;
        proc.stdin.write(data);
        proc.stdin.flush();
      }
    },

    close(ws, code, reason) {
      console.log(`[stdio-ws] Connection closed: code=${code}, reason=${reason}`);

      const proc = ws.data.proc;
      if (proc) {
        try {
          // Graceful shutdown: SIGTERM, then SIGKILL after timeout
          proc.kill('SIGTERM');
          setTimeout(() => {
            try {
              proc.kill('SIGKILL');
            } catch {
              // Already dead
            }
          }, 5000);
        } catch {
          // Already dead or can't kill
        }
      }
    },

    drain(ws) {
      // Called when WebSocket is ready to receive more data
      // We could implement backpressure here if needed
    },
  },
});

console.log('[stdio-ws] Server ready on port 8080');
