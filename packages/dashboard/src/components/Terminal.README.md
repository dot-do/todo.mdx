# Terminal Component

A React terminal component built with xterm.js for interactive Claude Code sessions over WebSocket.

## Features

- **Full ANSI Support**: Complete support for ANSI escape codes including colors, cursor movement, and screen clearing
- **Unicode Support**: Handles Claude Code's UI elements and emoji perfectly
- **Bidirectional WebSocket**: Real-time stdin/stdout communication with the server
- **Responsive Sizing**: Automatically adjusts to container size using FitAddon
- **Copy/Paste**: Full clipboard integration
- **Clickable URLs**: WebLinksAddon makes URLs in terminal output clickable
- **Auto-Reconnect**: Exponential backoff reconnection (up to 5 attempts)
- **Claude Code Aesthetic**: Dark theme matching Claude Code's visual style

## Installation

The component is part of the `@todo.mdx/dashboard` package. Install the required peer dependencies:

```bash
pnpm add react react-dom
```

The xterm.js dependencies are included:
- `@xterm/xterm` - Core terminal emulator
- `@xterm/addon-fit` - Responsive sizing
- `@xterm/addon-web-links` - URL detection and linking

## Usage

### Basic Example

```tsx
import { Terminal } from '@todo.mdx/dashboard/components'

function MyComponent() {
  const wsUrl = 'wss://api.todo.mdx.do/sandbox/ws?repo=owner/repo&task=Fix bug&installationId=123'

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <Terminal wsUrl={wsUrl} />
    </div>
  )
}
```

### With Event Handlers

```tsx
import { Terminal } from '@todo.mdx/dashboard/components'

function MyComponent() {
  return (
    <Terminal
      wsUrl="wss://api.todo.mdx.do/sandbox/ws?..."
      onConnect={() => console.log('Connected')}
      onDisconnect={() => console.log('Disconnected')}
      onData={(data) => console.log('User typed:', data)}
      onComplete={(exitCode) => console.log('Exit:', exitCode)}
      className="my-terminal"
    />
  )
}
```

### Full Screen

```tsx
function FullScreenTerminal() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Terminal wsUrl="wss://..." />
    </div>
  )
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `wsUrl` | `string` | Yes | WebSocket URL to connect to |
| `onConnect` | `() => void` | No | Called when WebSocket connects |
| `onDisconnect` | `() => void` | No | Called when WebSocket disconnects |
| `onData` | `(data: string) => void` | No | Called when user types in terminal |
| `onComplete` | `(exitCode: number) => void` | No | Called when session completes |
| `className` | `string` | No | Additional CSS class for container |

## WebSocket Protocol

### Server → Client Messages

The server sends JSON messages with this structure:

```typescript
interface WebSocketMessage {
  type: 'stdout' | 'stderr' | 'complete' | 'error'
  data?: string        // Terminal output (for stdout/stderr)
  exitCode?: number    // Exit code (for complete)
  error?: string       // Error message (for error)
}
```

Examples:

```json
// Stdout output
{ "type": "stdout", "data": "\u001b[32mSuccess!\u001b[0m\r\n" }

// Session complete
{ "type": "complete", "exitCode": 0 }

// Error
{ "type": "error", "error": "Failed to clone repo" }
```

### Client → Server Messages

The client sends JSON messages for user input and terminal resizing:

```typescript
interface ClientMessage {
  type: 'stdin' | 'resize'
  data?: string     // User input (for stdin)
  cols?: number     // Terminal columns (for resize)
  rows?: number     // Terminal rows (for resize)
}
```

Examples:

```json
// User typed a command
{ "type": "stdin", "data": "ls -la\r" }

// Terminal resized
{ "type": "resize", "cols": 120, "rows": 40 }
```

## Styling

The terminal uses the Claude Code color scheme with a dark background (`#1e1e1e`). You can customize the container with the `className` prop, but the terminal itself uses xterm.js theming.

To import the required CSS:

```tsx
import '@xterm/xterm/css/xterm.css'  // Already imported in Terminal.tsx
```

## Auto-Reconnect

The terminal automatically attempts to reconnect on connection loss:
- Uses exponential backoff: 1s, 2s, 4s, 8s, 10s (max)
- Maximum 5 reconnect attempts
- Shows error overlay if reconnection fails
- Normal closure (code 1000) does not trigger reconnection

## Terminal Configuration

The terminal is configured with:
- **Font**: `Menlo, Monaco, "Courier New", monospace`
- **Font Size**: 14px
- **Line Height**: 1.2
- **Scrollback**: 10,000 lines
- **Cursor**: Blinking block
- **Theme**: Claude Code dark theme

## Performance

- Handles high-frequency output efficiently
- Uses xterm.js's optimized rendering
- FitAddon recalculates size only on container resize
- WebSocket messages are batched by the browser

## Browser Compatibility

Requires a modern browser with:
- WebSocket support
- ES2020+ JavaScript
- Canvas API (used by xterm.js)

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Implementation Details

The component:
1. Creates an xterm.js Terminal instance on mount
2. Loads FitAddon and WebLinksAddon
3. Opens WebSocket connection
4. Sends initial resize event
5. Forwards terminal input to WebSocket
6. Writes WebSocket output to terminal
7. Handles reconnection with exponential backoff
8. Cleans up on unmount

## Related

- [xterm.js Documentation](https://xtermjs.org/)
- [Claude Code Sandbox](/worker/src/sandbox/claude.ts)
- [WebSocket Handler](/worker/src/sandbox/claude.ts#L159-L190)
