#!/usr/bin/env node
/**
 * sbx-stdio - CLI client for Cloudflare Sandbox stdio over WebSocket
 *
 * Usage:
 *   sbx-stdio <worker-url> [options]
 *
 * Examples:
 *   sbx-stdio https://api.todo.mdx.do/api/stdio/default --cmd bash
 *   sbx-stdio https://api.todo.mdx.do/api/stdio/my-sandbox --cmd node --arg script.js
 */

import process from 'node:process';
import {
  STREAM_STDOUT,
  STREAM_STDERR,
  unpack,
  createResizeMessage,
  isExitMessage,
} from '@todo.mdx/sandbox-stdio';

// ============================================================================
// Types
// ============================================================================

interface CliArgs {
  workerUrl: string;
  sandbox: string;
  cmd: string;
  args: string[];
  token?: string;
}

// ============================================================================
// Argument Parsing
// ============================================================================

function printUsage(exitCode = 0): never {
  console.log(`
sbx-stdio - Connect to Cloudflare Sandbox via WebSocket

Usage:
  sbx-stdio <worker-url> [options]

Options:
  --sandbox <id>    Sandbox ID (default: from URL or 'default')
  --cmd <command>   Command to run (default: 'bash')
  --arg <argument>  Command argument (repeatable)
  --token <token>   Authentication token
  --help, -h        Show this help message

Examples:
  # Interactive bash shell
  sbx-stdio https://api.todo.mdx.do/api/stdio/my-sandbox

  # Run a specific command
  sbx-stdio https://api.todo.mdx.do/api/stdio/build --cmd npm --arg test

  # Run a shell command
  sbx-stdio https://api.todo.mdx.do/api/stdio/dev \\
    --cmd bash --arg -lc --arg "npm install && npm test"

Controls:
  Ctrl+]  Exit (like telnet)
  Ctrl+C  Send SIGINT to remote process
`.trim());
  process.exit(exitCode);
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    workerUrl: '',
    sandbox: 'default',
    cmd: 'bash',
    args: [],
  };

  const rest = [...argv];

  // First positional argument is the worker URL
  if (rest.length > 0 && !rest[0].startsWith('-')) {
    args.workerUrl = rest.shift()!;
  }

  while (rest.length > 0) {
    const arg = rest.shift()!;

    switch (arg) {
      case '--help':
      case '-h':
        printUsage(0);
        break;

      case '--sandbox':
        args.sandbox = rest.shift() ?? args.sandbox;
        break;

      case '--cmd':
        args.cmd = rest.shift() ?? args.cmd;
        break;

      case '--arg':
        const argValue = rest.shift();
        if (argValue !== undefined) {
          args.args.push(argValue);
        }
        break;

      case '--token':
        args.token = rest.shift();
        break;

      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          printUsage(1);
        }
        // Treat as positional URL if we don't have one
        if (!args.workerUrl) {
          args.workerUrl = arg;
        } else {
          console.error(`Unexpected argument: ${arg}`);
          printUsage(1);
        }
    }
  }

  return args;
}

// ============================================================================
// WebSocket URL Builder
// ============================================================================

function buildWsUrl(args: CliArgs): string {
  if (!args.workerUrl) {
    console.error('Error: Worker URL is required');
    printUsage(1);
  }

  const url = new URL(args.workerUrl);

  // Convert http(s) to ws(s)
  if (url.protocol === 'https:') {
    url.protocol = 'wss:';
  } else if (url.protocol === 'http:') {
    url.protocol = 'ws:';
  }

  // Add query params
  url.searchParams.set('cmd', args.cmd);
  for (const arg of args.args) {
    url.searchParams.append('arg', arg);
  }
  if (args.token) {
    url.searchParams.set('token', args.token);
  }

  return url.toString();
}

// ============================================================================
// Terminal Mode Helpers
// ============================================================================

function enableRawMode(): void {
  if (process.stdin.isTTY && typeof (process.stdin as any).setRawMode === 'function') {
    (process.stdin as any).setRawMode(true);
  }
  process.stdin.resume();
}

function disableRawMode(): void {
  try {
    if (process.stdin.isTTY && typeof (process.stdin as any).setRawMode === 'function') {
      (process.stdin as any).setRawMode(false);
    }
  } catch {
    // Ignore errors on cleanup
  }
  process.stdin.pause();
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const wsUrl = buildWsUrl(args);

  // Check for token in environment if not provided
  if (!args.token) {
    args.token = process.env.SBX_TOKEN || process.env.TODO_MDX_TOKEN;
    if (args.token) {
      const url = new URL(wsUrl);
      url.searchParams.set('token', args.token);
    }
  }

  console.error(`Connecting to ${args.workerUrl}...`);
  console.error(`Command: ${args.cmd} ${args.args.join(' ')}`);
  console.error('Press Ctrl+] to exit\n');

  const ws = new WebSocket(wsUrl);
  ws.binaryType = 'arraybuffer';

  let exitCode: number | null = null;
  let connected = false;

  // Handle connection open
  ws.addEventListener('open', () => {
    connected = true;
    enableRawMode();

    // Send initial resize
    sendResize(ws);

    // Forward stdin to WebSocket
    process.stdin.on('data', (chunk: Buffer) => {
      // Ctrl+] (0x1d) = exit locally (like telnet)
      if (chunk.length === 1 && chunk[0] === 0x1d) {
        console.error('\nDisconnected.');
        ws.close(1000, 'User exit');
        return;
      }

      // Send as binary
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunk);
      }
    });

    // Handle terminal resize
    if (process.stdout.isTTY) {
      process.stdout.on('resize', () => sendResize(ws));
    }
  });

  // Handle incoming messages
  ws.addEventListener('message', (event) => {
    const data = event.data;

    // JSON control message (exit)
    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);
        if (isExitMessage(msg)) {
          exitCode = msg.code;
          ws.close(1000, 'Process exited');
          return;
        }
      } catch {
        // Not JSON, treat as text output (shouldn't happen with binary protocol)
        process.stdout.write(data);
      }
      return;
    }

    // Binary output - demux by stream ID
    const bytes = new Uint8Array(data as ArrayBuffer);
    const { streamId, payload } = unpack(bytes);

    if (streamId === STREAM_STDOUT) {
      process.stdout.write(Buffer.from(payload));
    } else if (streamId === STREAM_STDERR) {
      process.stderr.write(Buffer.from(payload));
    } else {
      // Unknown stream, write to stdout
      process.stdout.write(Buffer.from(payload));
    }
  });

  // Handle connection close
  ws.addEventListener('close', (event) => {
    disableRawMode();

    if (!connected) {
      console.error(`Failed to connect: ${event.reason || 'Unknown error'}`);
      process.exit(1);
    }

    if (exitCode !== null) {
      process.exit(exitCode);
    }

    process.exit(0);
  });

  // Handle errors
  ws.addEventListener('error', (event) => {
    console.error('WebSocket error:', event);
  });
}

/**
 * Send terminal resize message
 */
function sendResize(ws: WebSocket): void {
  if (!process.stdout.isTTY) return;
  if (ws.readyState !== WebSocket.OPEN) return;

  const msg = createResizeMessage(
    process.stdout.columns ?? 80,
    process.stdout.rows ?? 24
  );

  ws.send(JSON.stringify(msg));
}

// Run
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
