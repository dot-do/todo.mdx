/**
 * Wire protocol for stdio over WebSocket
 *
 * Binary format for stdout/stderr:
 *   [1 byte stream ID][N bytes payload]
 *
 * JSON format for control messages:
 *   { type: 'resize', cols: number, rows: number }
 *   { type: 'signal', signal: string }
 *   { type: 'exit', code: number }
 */

// Stream IDs for binary multiplexing
export const STREAM_STDOUT = 0x01;
export const STREAM_STDERR = 0x02;

// Control message types (JSON)
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

export type ClientMessage = ResizeMessage | SignalMessage;
export type ServerMessage = ExitMessage;

/**
 * Pack a chunk with stream ID prefix for multiplexing
 */
export function pack(streamId: number, chunk: Uint8Array): Uint8Array {
  const out = new Uint8Array(1 + chunk.byteLength);
  out[0] = streamId;
  out.set(chunk, 1);
  return out;
}

/**
 * Unpack stream ID from a binary message
 */
export function unpack(data: Uint8Array): { streamId: number; payload: Uint8Array } {
  if (data.length === 0) {
    return { streamId: 0, payload: new Uint8Array(0) };
  }
  return {
    streamId: data[0],
    payload: data.subarray(1),
  };
}

/**
 * Type guard for control messages
 */
export function isControlMessage(data: unknown): data is ControlMessage {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const msg = data as Record<string, unknown>;
  return (
    msg.type === 'resize' ||
    msg.type === 'signal' ||
    msg.type === 'exit'
  );
}

/**
 * Type guard for resize message
 */
export function isResizeMessage(data: unknown): data is ResizeMessage {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const msg = data as Record<string, unknown>;
  return (
    msg.type === 'resize' &&
    typeof msg.cols === 'number' &&
    typeof msg.rows === 'number'
  );
}

/**
 * Type guard for signal message
 */
export function isSignalMessage(data: unknown): data is SignalMessage {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const msg = data as Record<string, unknown>;
  return msg.type === 'signal' && typeof msg.signal === 'string';
}

/**
 * Type guard for exit message
 */
export function isExitMessage(data: unknown): data is ExitMessage {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const msg = data as Record<string, unknown>;
  return msg.type === 'exit' && typeof msg.code === 'number';
}

/**
 * Create a resize message
 */
export function createResizeMessage(cols: number, rows: number): ResizeMessage {
  return { type: 'resize', cols, rows };
}

/**
 * Create a signal message
 */
export function createSignalMessage(signal: string): SignalMessage {
  return { type: 'signal', signal };
}

/**
 * Create an exit message
 */
export function createExitMessage(code: number): ExitMessage {
  return { type: 'exit', code };
}

/**
 * Parsed message result types
 */
export type ParsedBinaryMessage = {
  kind: 'binary';
  streamId: number;
  payload: Uint8Array;
};

export type ParsedControlMessage = {
  kind: 'control';
  message: ControlMessage;
};

export type ParsedStdinMessage = {
  kind: 'stdin';
  data: Uint8Array;
};

export type ParsedMessage = ParsedBinaryMessage | ParsedControlMessage;

/**
 * Parse an incoming WebSocket message (server-side)
 *
 * Handles both binary (stdin) and JSON (control) messages
 */
export function parseClientMessage(
  data: string | ArrayBuffer | Uint8Array
): ParsedStdinMessage | ParsedControlMessage {
  // JSON control message
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      if (isControlMessage(parsed)) {
        return { kind: 'control', message: parsed };
      }
    } catch {
      // Not valid JSON, treat as text stdin (unlikely but possible)
    }
    // Convert string to bytes for stdin
    return { kind: 'stdin', data: new TextEncoder().encode(data) };
  }

  // Binary stdin
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return { kind: 'stdin', data: bytes };
}

/**
 * Parse an incoming WebSocket message (client-side)
 *
 * Handles both binary (stdout/stderr) and JSON (exit) messages
 */
export function parseServerMessage(
  data: string | ArrayBuffer | Uint8Array
): ParsedBinaryMessage | ParsedControlMessage {
  // JSON control message (exit)
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      if (isControlMessage(parsed)) {
        return { kind: 'control', message: parsed };
      }
    } catch {
      // Not valid JSON
    }
    throw new Error('Invalid server message: expected JSON control message');
  }

  // Binary output with stream ID
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const { streamId, payload } = unpack(bytes);
  return { kind: 'binary', streamId, payload };
}

/**
 * Check if a stream ID is stdout
 */
export function isStdout(streamId: number): boolean {
  return streamId === STREAM_STDOUT;
}

/**
 * Check if a stream ID is stderr
 */
export function isStderr(streamId: number): boolean {
  return streamId === STREAM_STDERR;
}

/**
 * Get stream name from ID
 */
export function getStreamName(streamId: number): 'stdout' | 'stderr' | 'unknown' {
  switch (streamId) {
    case STREAM_STDOUT:
      return 'stdout';
    case STREAM_STDERR:
      return 'stderr';
    default:
      return 'unknown';
  }
}
