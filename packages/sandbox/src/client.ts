/**
 * Sandbox Stdio Client
 *
 * CLI client that mirrors local stdin/stdout to a sandbox WebSocket.
 * Authenticates via oauth.do (WorkOS custom domain).
 *
 * @example
 * ```bash
 * # Interactive shell
 * sbx https://todo.mdx.do/terminal --sandbox my-session --cmd bash
 *
 * # Run specific command
 * sbx https://todo.mdx.do/terminal --sandbox build --cmd npm --arg test
 * ```
 */

import { ensureLoggedIn } from 'oauth.do/node'
import {
  parseServerMessage,
  STREAM_STDOUT,
  STREAM_STDERR,
  resize,
  signal,
  isExitMessage,
  isErrorMessage,
} from './protocol'

// ============================================================================
// Types
// ============================================================================

export interface SandboxClientOptions {
  /** Worker URL (https://...) - will be converted to wss:// */
  url: string
  /** Sandbox session ID */
  sandbox?: string
  /** Command to run (default: bash) */
  cmd?: string
  /** Command arguments */
  args?: string[]
  /** Auth token (if not using oauth.do flow) */
  token?: string
  /** Called on stdout data */
  onStdout?: (data: Uint8Array) => void
  /** Called on stderr data */
  onStderr?: (data: Uint8Array) => void
  /** Called on exit */
  onExit?: (code: number) => void
  /** Called on error */
  onError?: (message: string) => void
  /** Called when connected */
  onConnect?: () => void
}

export interface SandboxConnection {
  /** Send stdin data */
  write(data: string | Uint8Array): void
  /** Send resize event */
  resize(cols: number, rows: number): void
  /** Send signal to process */
  kill(signal?: string): void
  /** Close connection */
  close(): void
  /** Wait for exit */
  wait(): Promise<number>
}

// ============================================================================
// Client Implementation
// ============================================================================

/**
 * Connect to a sandbox WebSocket
 */
export async function connect(options: SandboxClientOptions): Promise<SandboxConnection> {
  const {
    url,
    sandbox = 'default',
    cmd = 'bash',
    args = [],
    onStdout = (data) => process.stdout.write(data),
    onStderr = (data) => process.stderr.write(data),
    onExit,
    onError,
    onConnect,
  } = options

  // Get auth token
  let token = options.token
  if (!token) {
    const auth = await ensureLoggedIn()
    token = auth.token
  }

  // Build WebSocket URL
  const wsUrl = buildWsUrl(url, { sandbox, cmd, args, token })

  // Create WebSocket
  const ws = new WebSocket(wsUrl)
  ws.binaryType = 'arraybuffer'

  let exitCode: number | null = null
  let exitResolve: ((code: number) => void) | null = null

  const exitPromise = new Promise<number>((resolve) => {
    exitResolve = resolve
  })

  // Handle messages
  ws.onmessage = (event) => {
    try {
      const parsed = parseServerMessage(event.data)

      if (parsed.kind === 'binary') {
        if (parsed.streamId === STREAM_STDOUT) {
          onStdout(parsed.payload)
        } else if (parsed.streamId === STREAM_STDERR) {
          onStderr(parsed.payload)
        }
      } else if (parsed.kind === 'control') {
        if (isExitMessage(parsed.message)) {
          exitCode = parsed.message.code
          onExit?.(exitCode)
          exitResolve?.(exitCode)
        } else if (isErrorMessage(parsed.message)) {
          onError?.(parsed.message.message)
        }
      }
    } catch (err) {
      console.error('[sandbox-client] Parse error:', err)
    }
  }

  ws.onopen = () => {
    onConnect?.()
  }

  ws.onerror = (event) => {
    onError?.('WebSocket error')
  }

  ws.onclose = () => {
    if (exitCode === null) {
      exitResolve?.(1)
    }
  }

  // Wait for connection
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000)

    ws.onopen = () => {
      clearTimeout(timeout)
      onConnect?.()
      resolve()
    }

    ws.onerror = () => {
      clearTimeout(timeout)
      reject(new Error('Connection failed'))
    }
  })

  // Return connection interface
  return {
    write(data: string | Uint8Array) {
      const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
      ws.send(bytes)
    },

    resize(cols: number, rows: number) {
      ws.send(JSON.stringify(resize(cols, rows)))
    },

    kill(sig = 'SIGTERM') {
      ws.send(JSON.stringify(signal(sig)))
    },

    close() {
      ws.close()
    },

    wait() {
      return exitPromise
    },
  }
}

/**
 * Run interactive session (enables raw mode, handles Ctrl+])
 */
export async function runInteractive(options: SandboxClientOptions): Promise<number> {
  const conn = await connect(options)

  // Enable raw mode if TTY
  const isTTY = process.stdin.isTTY
  if (isTTY) {
    ;(process.stdin as typeof process.stdin & { setRawMode: (mode: boolean) => void }).setRawMode(
      true
    )
  }

  process.stdin.resume()

  // Forward stdin to WebSocket
  process.stdin.on('data', (chunk: Buffer) => {
    // Ctrl+] (0x1d) to exit locally (like telnet)
    if (chunk.length === 1 && chunk[0] === 0x1d) {
      cleanup()
      conn.close()
      return
    }
    conn.write(chunk)
  })

  // Send initial resize
  if (isTTY) {
    conn.resize(process.stdout.columns ?? 80, process.stdout.rows ?? 24)

    // Handle terminal resize
    process.stdout.on('resize', () => {
      conn.resize(process.stdout.columns ?? 80, process.stdout.rows ?? 24)
    })
  }

  // Cleanup function
  const cleanup = () => {
    if (isTTY) {
      ;(process.stdin as typeof process.stdin & { setRawMode: (mode: boolean) => void }).setRawMode(
        false
      )
    }
    process.stdin.pause()
  }

  // Wait for exit
  const code = await conn.wait()
  cleanup()

  return code
}

// ============================================================================
// Helpers
// ============================================================================

function buildWsUrl(
  baseUrl: string,
  params: { sandbox: string; cmd: string; args: string[]; token: string }
): string {
  const url = new URL(baseUrl)

  // Convert http(s) to ws(s)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'

  // Add query params
  url.searchParams.set('sandbox', params.sandbox)
  url.searchParams.set('cmd', params.cmd)
  url.searchParams.set('token', params.token)

  for (const arg of params.args) {
    url.searchParams.append('arg', arg)
  }

  return url.toString()
}

// ============================================================================
// CLI Entry Point
// ============================================================================

interface CliArgs {
  url: string
  sandbox: string
  cmd: string
  args: string[]
  token?: string
}

function parseCliArgs(argv: string[]): CliArgs {
  const result: CliArgs = {
    url: '',
    sandbox: 'default',
    cmd: 'bash',
    args: [],
  }

  let i = 0
  while (i < argv.length) {
    const arg = argv[i]

    if (arg === '--sandbox' || arg === '-s') {
      result.sandbox = argv[++i]
    } else if (arg === '--cmd' || arg === '-c') {
      result.cmd = argv[++i]
    } else if (arg === '--arg' || arg === '-a') {
      result.args.push(argv[++i])
    } else if (arg === '--token' || arg === '-t') {
      result.token = argv[++i]
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: sbx <url> [options]

Options:
  --sandbox, -s <id>     Sandbox session ID (default: default)
  --cmd, -c <command>    Command to run (default: bash)
  --arg, -a <arg>        Command argument (repeatable)
  --token, -t <token>    Auth token (skips oauth.do login)
  --help, -h             Show this help

Examples:
  sbx https://todo.mdx.do/terminal
  sbx https://todo.mdx.do/terminal --sandbox build --cmd npm --arg test
  sbx https://todo.mdx.do/terminal -c node -a script.js -a --verbose

Press Ctrl+] to exit (like telnet)
`)
      process.exit(0)
    } else if (!arg.startsWith('-') && !result.url) {
      result.url = arg
    }

    i++
  }

  if (!result.url) {
    console.error('Error: URL is required')
    console.error('Usage: sbx <url> [options]')
    process.exit(1)
  }

  return result
}

/**
 * CLI entry point
 */
export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = parseCliArgs(argv)

  try {
    const code = await runInteractive({
      url: args.url,
      sandbox: args.sandbox,
      cmd: args.cmd,
      args: args.args,
      token: args.token,
    })

    process.exit(code)
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

if (import.meta.main) {
  main()
}
