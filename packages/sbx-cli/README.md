# @todo.mdx/sbx-cli

CLI client for connecting to Cloudflare Sandbox containers via WebSocket.

## Installation

```bash
# Via npm/pnpm
npm install -g @todo.mdx/sbx-cli

# Or download standalone binary from releases
```

## Usage

```bash
# Interactive bash shell in sandbox
sbx-stdio https://todo.mdx.do/api/stdio/my-sandbox --token $TODO_MDX_TOKEN

# Run a specific command
sbx-stdio https://todo.mdx.do/api/stdio/build --token $TOKEN --cmd npm --arg test

# Run a shell command with arguments
sbx-stdio https://todo.mdx.do/api/stdio/dev --token $TOKEN \
  --cmd bash --arg -c --arg "npm install && npm test"
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--sandbox <id>` | Sandbox ID | from URL or 'default' |
| `--cmd <command>` | Command to run | 'bash' |
| `--arg <argument>` | Command argument (repeatable) | |
| `--token <token>` | Authentication token | `$SBX_TOKEN` or `$TODO_MDX_TOKEN` |
| `--help, -h` | Show help message | |

## Controls

| Key | Action |
|-----|--------|
| Ctrl+] | Exit (like telnet) |
| Ctrl+C | Send SIGINT to remote process |

## Building Standalone Binaries

```bash
# Build for current platform
pnpm run compile

# Build for all platforms
pnpm run compile:all

# Build for specific platform
pnpm run compile:macos-arm64
pnpm run compile:macos-x64
pnpm run compile:linux-x64
pnpm run compile:linux-arm64
```

## Protocol

Uses binary WebSocket protocol for efficient stdin/stdout/stderr multiplexing:

- **stdin**: Binary messages sent directly to remote process
- **stdout**: Binary with `0x01` prefix
- **stderr**: Binary with `0x02` prefix
- **resize**: JSON `{ type: 'resize', cols, rows }`
- **exit**: JSON `{ type: 'exit', code }`

See `@todo.mdx/sandbox-stdio` for protocol details.

## License

MIT
