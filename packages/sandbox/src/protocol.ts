/**
 * Wire Protocol for Stdio-over-WebSocket
 *
 * Binary-first protocol for low-latency terminal I/O.
 * Multiplexes stdout/stderr over a single WebSocket connection.
 *
 * @example
 * ```ts
 * import { pack, unpack, STREAM_STDOUT } from '@todo.mdx/sandbox/protocol'
 *
 * // Server: send stdout
 * ws.send(pack(STREAM_STDOUT, chunk))
 *
 * // Client: receive and demux
 * const { streamId, payload } = unpack(new Uint8Array(event.data))
 * if (streamId === STREAM_STDOUT) process.stdout.write(payload)
 * ```
 */

// ============================================================================
// Stream IDs (Binary Protocol)
// ============================================================================

/** stdout stream identifier */
export const STREAM_STDOUT = 0x01

/** stderr stream identifier */
export const STREAM_STDERR = 0x02

// ============================================================================
// Control Messages (JSON Text)
// ============================================================================

/** Terminal resize event (client → server) */
export interface ResizeMessage {
  type: 'resize'
  cols: number
  rows: number
}

/** Signal event (client → server) */
export interface SignalMessage {
  type: 'signal'
  signal: 'SIGINT' | 'SIGTERM' | 'SIGKILL' | 'SIGHUP' | string
}

/** Process exit event (server → client) */
export interface ExitMessage {
  type: 'exit'
  code: number
}

/** Error event (server → client) */
export interface ErrorMessage {
  type: 'error'
  message: string
}

/** All control message types */
export type ControlMessage = ResizeMessage | SignalMessage | ExitMessage | ErrorMessage

// ============================================================================
// Binary Frame Helpers
// ============================================================================

/**
 * Pack output data with stream ID prefix
 *
 * Frame format: [streamId:1byte][payload:Nbytes]
 */
export function pack(streamId: number, chunk: Uint8Array): Uint8Array {
  const out = new Uint8Array(1 + chunk.byteLength)
  out[0] = streamId
  out.set(chunk, 1)
  return out
}

/**
 * Unpack stream ID and payload from binary frame
 */
export function unpack(data: Uint8Array): { streamId: number; payload: Uint8Array } {
  return {
    streamId: data[0],
    payload: data.subarray(1),
  }
}

// ============================================================================
// Message Type Guards
// ============================================================================

/** Check if value is a control message */
export function isControlMessage(data: unknown): data is ControlMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    typeof (data as { type: unknown }).type === 'string'
  )
}

/** Check if message is a resize event */
export function isResizeMessage(msg: ControlMessage): msg is ResizeMessage {
  return msg.type === 'resize'
}

/** Check if message is a signal event */
export function isSignalMessage(msg: ControlMessage): msg is SignalMessage {
  return msg.type === 'signal'
}

/** Check if message is an exit event */
export function isExitMessage(msg: ControlMessage): msg is ExitMessage {
  return msg.type === 'exit'
}

/** Check if message is an error event */
export function isErrorMessage(msg: ControlMessage): msg is ErrorMessage {
  return msg.type === 'error'
}

// ============================================================================
// Parsed Message Types
// ============================================================================

export type ParsedBinaryMessage = {
  kind: 'binary'
  streamId: number
  payload: Uint8Array
}

export type ParsedControlMessage = {
  kind: 'control'
  message: ControlMessage
}

export type ParsedStdinMessage = {
  kind: 'stdin'
  data: Uint8Array
}

export type ParsedMessage = ParsedBinaryMessage | ParsedControlMessage | ParsedStdinMessage

/**
 * Parse incoming WebSocket message
 *
 * - String messages are parsed as JSON control messages
 * - Binary messages from server have stream ID prefix (stdout/stderr)
 * - Binary messages from client are raw stdin
 */
export function parseServerMessage(
  data: string | ArrayBuffer | Uint8Array
): ParsedBinaryMessage | ParsedControlMessage {
  if (typeof data === 'string') {
    const parsed = JSON.parse(data)
    if (isControlMessage(parsed)) {
      return { kind: 'control', message: parsed }
    }
    throw new Error(`Unknown control message: ${data}`)
  }

  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const { streamId, payload } = unpack(bytes)
  return { kind: 'binary', streamId, payload }
}

/**
 * Parse client message (stdin or control)
 */
export function parseClientMessage(
  data: string | ArrayBuffer | Uint8Array
): ParsedStdinMessage | ParsedControlMessage {
  if (typeof data === 'string') {
    const parsed = JSON.parse(data)
    if (isControlMessage(parsed)) {
      return { kind: 'control', message: parsed }
    }
    throw new Error(`Unknown control message: ${data}`)
  }

  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  return { kind: 'stdin', data: bytes }
}

// ============================================================================
// Control Message Constructors
// ============================================================================

/** Create a resize message */
export function resize(cols: number, rows: number): ResizeMessage {
  return { type: 'resize', cols, rows }
}

/** Create a signal message */
export function signal(sig: SignalMessage['signal']): SignalMessage {
  return { type: 'signal', signal: sig }
}

/** Create an exit message */
export function exit(code: number): ExitMessage {
  return { type: 'exit', code }
}

/** Create an error message */
export function error(message: string): ErrorMessage {
  return { type: 'error', message }
}
