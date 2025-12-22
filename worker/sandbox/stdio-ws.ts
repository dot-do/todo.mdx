#!/usr/bin/env bun
/**
 * Stdio WebSocket Server for Sandbox Container
 *
 * Runs inside the Cloudflare Sandbox container on port 8080.
 * Bridges WebSocket connections to child process stdio.
 *
 * Protocol:
 * - Client → Server: Binary (stdin), JSON (resize/signal)
 * - Server → Client: Binary with stream ID prefix (stdout/stderr), JSON (exit)
 */

// Stream IDs for binary protocol
const STREAM_STDOUT = 0x01
const STREAM_STDERR = 0x02

// Pack output with stream ID prefix
function pack(streamId: number, chunk: Uint8Array): Uint8Array {
  const out = new Uint8Array(1 + chunk.byteLength)
  out[0] = streamId
  out.set(chunk, 1)
  return out
}

// Control message types
interface ControlMessage {
  type: 'resize' | 'signal' | 'exit' | 'error' | 'eof'
  cols?: number
  rows?: number
  signal?: string
  code?: number
  message?: string
}

function isControlMessage(data: unknown): data is ControlMessage {
  return typeof data === 'object' && data !== null && 'type' in data
}

// WebSocket data context
interface WsData {
  cmd: string
  args: string[]
  env: Record<string, string>
  proc?: ReturnType<typeof Bun.spawn>
}

// Pump readable stream to WebSocket
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
  } catch {
    // Stream closed - normal during shutdown
  }
}

const PORT = parseInt(process.env.STDIO_WS_PORT ?? '8080', 10)

console.log(`[stdio-ws] Starting server on 0.0.0.0:${PORT}`)

Bun.serve<WsData>({
  port: PORT,
  hostname: '0.0.0.0',

  fetch(req, server) {
    const url = new URL(req.url)
    const cmd = url.searchParams.get('cmd') ?? 'bash'
    const args = url.searchParams.getAll('arg')

    // Parse env vars from query params (env_NAME=value)
    const env: Record<string, string> = {}
    for (const [key, value] of url.searchParams) {
      if (key.startsWith('env_')) {
        env[key.slice(4)] = value
      }
    }

    // Upgrade to WebSocket
    if (server.upgrade(req, { data: { cmd, args, env } })) {
      return undefined
    }

    // Non-WebSocket request - return info
    return new Response(
      JSON.stringify({
        service: 'sandbox-stdio-ws',
        version: '0.0.1',
        usage: 'Connect via WebSocket with ?cmd=<command>&arg=<arg>',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  },

  websocket: {
    open(ws) {
      const { cmd, args, env: extraEnv } = ws.data

      console.log(`[stdio-ws] Connection: ${cmd} ${args.join(' ')}`)

      // Spawn child process with merged environment
      const proc = Bun.spawn([cmd, ...args], {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          ...process.env,
          ...extraEnv,
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
          console.log(`[stdio-ws] Process exited with code ${code}`)
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'exit', code }))
            ws.close(1000, 'Process exited')
          }
        })
        .catch((err) => {
          console.error(`[stdio-ws] Process error:`, err)
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'error', message: err.message }))
            ws.close(1011, 'Process error')
          }
        })
    },

    message(ws, msg) {
      const proc = ws.data.proc
      if (!proc) return

      try {
        // JSON control messages
        if (typeof msg === 'string') {
          const parsed = JSON.parse(msg)
          if (isControlMessage(parsed)) {
            if (parsed.type === 'signal' && parsed.signal) {
              proc.kill(parsed.signal as NodeJS.Signals)
            } else if (parsed.type === 'eof') {
              // Close stdin to signal EOF to the child process
              const stdin = proc.stdin as import('bun').FileSink
              stdin.end()
              console.log('[stdio-ws] EOF received, closing stdin')
            }
            // resize is ignored in pipe mode (requires PTY)
          }
          return
        }

        // Binary: write to stdin
        const stdin = proc.stdin as import('bun').FileSink
        stdin.write(msg)
        stdin.flush()
      } catch (err) {
        console.error('[stdio-ws] Message error:', err)
      }
    },

    close(ws) {
      const proc = ws.data.proc
      if (proc) {
        try {
          proc.kill('SIGTERM')
        } catch {
          // Process may have already exited
        }
      }
      console.log('[stdio-ws] Connection closed')
    },
  },
})

console.log(`[stdio-ws] Ready on port ${PORT}`)
