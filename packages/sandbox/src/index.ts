/**
 * @todo.mdx/sandbox
 *
 * Stdio-over-WebSocket transport for Cloudflare Sandbox.
 * Enables CLI and browser clients to interact with sandboxed processes.
 *
 * @example
 * ```ts
 * // Client usage
 * import { connect, runInteractive } from '@todo.mdx/sandbox'
 *
 * const conn = await connect({
 *   url: 'https://todo.mdx.do/terminal',
 *   sandbox: 'my-session',
 *   cmd: 'bash'
 * })
 *
 * conn.write('echo hello\n')
 * ```
 *
 * @example
 * ```ts
 * // Server usage (inside sandbox)
 * import { createStdioServer } from '@todo.mdx/sandbox/server'
 *
 * createStdioServer({ port: 8080 })
 * ```
 *
 * @example
 * ```ts
 * // Protocol usage
 * import { pack, unpack, STREAM_STDOUT } from '@todo.mdx/sandbox/protocol'
 *
 * ws.send(pack(STREAM_STDOUT, chunk))
 * ```
 */

// Protocol types and helpers
export {
  // Stream IDs
  STREAM_STDOUT,
  STREAM_STDERR,
  // Message types
  type ResizeMessage,
  type SignalMessage,
  type ExitMessage,
  type ErrorMessage,
  type ControlMessage,
  type ParsedMessage,
  type ParsedBinaryMessage,
  type ParsedControlMessage,
  type ParsedStdinMessage,
  // Binary helpers
  pack,
  unpack,
  // Parse helpers
  parseServerMessage,
  parseClientMessage,
  // Type guards
  isControlMessage,
  isResizeMessage,
  isSignalMessage,
  isExitMessage,
  isErrorMessage,
  // Constructors
  resize,
  signal,
  exit,
  error,
} from './protocol'

// Server (for sandbox container)
export { createStdioServer, type StdioServerOptions } from './server'

// Client (for CLI/browser)
export { connect, runInteractive, main, type SandboxClientOptions, type SandboxConnection } from './client'
