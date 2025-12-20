/**
 * Sandbox Stdio WebSocket Server
 *
 * Runs inside the Cloudflare Sandbox container on port 8080.
 * Bridges WebSocket connections to child process stdio.
 *
 * @example
 * ```bash
 * # In sandbox container
 * bun run /workspace/stdio-ws.ts
 * ```
 *
 * @example
 * ```ts
 * // Programmatic usage
 * import { createStdioServer } from '@todo.mdx/sandbox/server'
 *
 * createStdioServer({ port: 8080 })
 * ```
 */

import {
  pack,
  STREAM_STDOUT,
  STREAM_STDERR,
  parseClientMessage,
  exit,
  error,
  isResizeMessage,
  isSignalMessage,
  type ControlMessage,
} from './protocol'

// ============================================================================
// Types
// ============================================================================

export interface StdioServerOptions {
  /** Port to listen on (default: 8080) */
  port?: number
  /** Hostname to bind to (default: 0.0.0.0) */
  hostname?: string
  /** Default command if none specified (default: bash) */
  defaultCommand?: string
  /** Called when a connection is established */
  onConnect?: (cmd: string, args: string[]) => void
  /** Called when a connection is closed */
  onDisconnect?: (code: number) => void
}

interface WsData {
  cmd: string
  args: string[]
  proc?: ReturnType<typeof Bun.spawn>
}

// ============================================================================
// Server Implementation
// ============================================================================

/**
 * Create and start the stdio WebSocket server
 *
 * Query parameters:
 * - `cmd`: Command to execute (default: bash)
 * - `arg`: Repeatable arguments for the command
 *
 * @example
 * ```
 * ws://localhost:8080/?cmd=bash
 * ws://localhost:8080/?cmd=node&arg=script.js&arg=--verbose
 * ```
 */
export function createStdioServer(options: StdioServerOptions = {}) {
  const {
    port = 8080,
    hostname = '0.0.0.0',
    defaultCommand = 'bash',
    onConnect,
    onDisconnect,
  } = options

  return Bun.serve<WsData>({
    port,
    hostname,

    fetch(req, server) {
      const url = new URL(req.url)
      const cmd = url.searchParams.get('cmd') ?? defaultCommand
      const args = url.searchParams.getAll('arg')

      // Upgrade to WebSocket
      if (server.upgrade(req, { data: { cmd, args } })) {
        return undefined
      }

      // Non-WebSocket request - return info
      return new Response(
        JSON.stringify({
          service: 'sandbox-stdio',
          version: '0.0.1',
          usage: 'Connect via WebSocket with ?cmd=<command>&arg=<arg>',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    },

    websocket: {
      open(ws) {
        const { cmd, args } = ws.data

        onConnect?.(cmd, args)

        // Spawn child process
        const proc = Bun.spawn([cmd, ...args], {
          stdin: 'pipe',
          stdout: 'pipe',
          stderr: 'pipe',
          env: {
            ...process.env,
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
          },
        })

        ws.data.proc = proc

        // Pump stdout → WebSocket
        pumpStream(ws, STREAM_STDOUT, proc.stdout)

        // Pump stderr → WebSocket
        pumpStream(ws, STREAM_STDERR, proc.stderr)

        // Handle process exit
        proc.exited
          .then((code) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(exit(code)))
              ws.close(1000, 'Process exited')
            }
            onDisconnect?.(code)
          })
          .catch((err) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(error(err.message)))
              ws.close(1011, 'Process error')
            }
          })
      },

      message(ws, msg) {
        const proc = ws.data.proc
        if (!proc) return

        try {
          const parsed = parseClientMessage(msg)

          if (parsed.kind === 'stdin') {
            // Write raw bytes to stdin
            const stdin = proc.stdin as import('bun').FileSink
            stdin.write(parsed.data)
            stdin.flush()
          } else if (parsed.kind === 'control') {
            handleControlMessage(proc, parsed.message)
          }
        } catch (err) {
          console.error('[stdio-ws] Message parse error:', err)
        }
      },

      close(ws, code, reason) {
        const proc = ws.data.proc
        if (proc) {
          try {
            proc.kill('SIGTERM')
          } catch {
            // Process may have already exited
          }
        }
      },

      drain(ws) {
        // Called when backpressure is relieved
      },
    },
  })
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Handle control messages from client
 */
function handleControlMessage(
  proc: ReturnType<typeof Bun.spawn>,
  message: ControlMessage
): void {
  if (isSignalMessage(message)) {
    // Cast signal string to valid signal type
    proc.kill(message.signal as NodeJS.Signals)
  } else if (isResizeMessage(message)) {
    // Resize is only meaningful with PTY (future enhancement)
    // For now, we ignore it in pipe mode
  }
}

/**
 * Pump readable stream to WebSocket with stream ID prefix
 */
async function pumpStream(
  ws: { send: (data: Uint8Array) => void; readyState: number },
  streamId: number,
  stream?: ReadableStream<Uint8Array> | null
): Promise<void> {
  if (!stream) return

  try {
    const reader = stream.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (ws.readyState !== WebSocket.OPEN) break

        ws.send(pack(streamId, value))
      }
    } finally {
      reader.releaseLock()
    }
  } catch (err) {
    // Stream closed or error - normal during shutdown
  }
}

// ============================================================================
// Standalone Entry Point
// ============================================================================

/**
 * Start server when run directly
 *
 * @example
 * ```bash
 * bun run packages/sandbox/src/server.ts
 * ```
 */
if (import.meta.main) {
  const port = parseInt(process.env.PORT ?? '8080', 10)

  console.log(`[stdio-ws] Starting server on 0.0.0.0:${port}`)

  createStdioServer({
    port,
    onConnect(cmd, args) {
      console.log(`[stdio-ws] Connection: ${cmd} ${args.join(' ')}`)
    },
    onDisconnect(code) {
      console.log(`[stdio-ws] Disconnected with code ${code}`)
    },
  })

  console.log(`[stdio-ws] Ready`)
}
