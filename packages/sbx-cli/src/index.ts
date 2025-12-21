/**
 * @todo.mdx/sbx-cli
 *
 * CLI client for connecting to Cloudflare Sandbox containers via WebSocket.
 * Uses the binary stdio protocol for efficient stdin/stdout/stderr multiplexing.
 *
 * @example
 * ```bash
 * # Install globally
 * npm install -g @todo.mdx/sbx-cli
 *
 * # Connect to a sandbox
 * sbx-stdio https://api.todo.mdx.do/api/stdio/my-sandbox --cmd bash
 * ```
 */

export {
  STREAM_STDOUT,
  STREAM_STDERR,
  pack,
  unpack,
  createResizeMessage,
  createSignalMessage,
  createExitMessage,
  isExitMessage,
  parseServerMessage,
  type ResizeMessage,
  type SignalMessage,
  type ExitMessage,
} from '@todo.mdx/sandbox-stdio';
