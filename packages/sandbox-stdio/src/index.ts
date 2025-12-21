/**
 * @todo.mdx/sandbox-stdio
 *
 * Wire protocol for stdio over WebSocket - shared between
 * sandbox server, CLI client, and browser clients.
 */

export {
  // Stream IDs
  STREAM_STDOUT,
  STREAM_STDERR,

  // Message types
  type ResizeMessage,
  type SignalMessage,
  type ExitMessage,
  type ControlMessage,
  type ClientMessage,
  type ServerMessage,

  // Parsed message types
  type ParsedBinaryMessage,
  type ParsedControlMessage,
  type ParsedStdinMessage,
  type ParsedMessage,

  // Binary helpers
  pack,
  unpack,

  // Type guards
  isControlMessage,
  isResizeMessage,
  isSignalMessage,
  isExitMessage,

  // Message factories
  createResizeMessage,
  createSignalMessage,
  createExitMessage,

  // Parsing
  parseClientMessage,
  parseServerMessage,

  // Stream utilities
  isStdout,
  isStderr,
  getStreamName,
} from './protocol.js';
