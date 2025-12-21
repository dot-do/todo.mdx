---
id: todo-5zv
title: "Web terminal component with xterm.js + React"
state: closed
priority: 1
type: feature
labels: [react, terminal, xterm]
---

# Web terminal component with xterm.js + React

Build a React terminal component using xterm.js that can render Claude Code's TUI output.

## Requirements
- Full ANSI escape code support (colors, cursor movement, clearing)
- Unicode support for Claude Code's UI elements
- Bidirectional WebSocket for stdin/stdout
- Responsive sizing with xterm-addon-fit
- Copy/paste support

## Implementation

### Dependencies
```bash
pnpm add @xterm/xterm @xterm/addon-fit @xterm/addon-web-links
pnpm add react-xtermjs  # or @pablo-lion/xterm-react
```

### Component
```tsx
// packages/dashboard/src/components/Terminal.tsx
import { useXTerm } from 'react-xtermjs'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'

interface TerminalProps {
  wsUrl: string
  onConnect?: () => void
  onDisconnect?: () => void
}

export function Terminal({ wsUrl, onConnect, onDisconnect }: TerminalProps) {
  const { instance, ref } = useXTerm({
    options: {
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Menlo, monospace',
      theme: {
        background: '#1a1a2e',
        foreground: '#eaeaea',
        cursor: '#f39c12',
      }
    }
  })

  useEffect(() => {
    if (!instance) return

    // Add addons
    const fitAddon = new FitAddon()
    instance.loadAddon(fitAddon)
    instance.loadAddon(new WebLinksAddon())
    fitAddon.fit()

    // WebSocket connection
    const ws = new WebSocket(wsUrl)
    
    ws.onopen = () => {
      onConnect?.()
      instance.focus()
    }

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'stdout' || msg.type === 'stderr') {
        instance.write(msg.data)
      }
    }

    ws.onclose = () => onDisconnect?.()

    // Send keystrokes
    instance.onData((data) => ws.send(JSON.stringify({ type: 'stdin', data })))

    // Handle resize
    const handleResize = () => fitAddon.fit()
    window.addEventListener('resize', handleResize)

    return () => {
      ws.close()
      window.removeEventListener('resize', handleResize)
    }
  }, [instance, wsUrl])

  return <div ref={ref} className="h-full w-full" />
}
```

## Styling
Match Claude Code's terminal aesthetic - dark theme, monospace font, proper line height for box-drawing characters.

## Testing
- Verify ANSI color rendering
- Test Unicode box-drawing characters
- Confirm cursor movement/clearing works
- Test with actual Claude Code output samples

### Related Issues

**Blocks:**
- **todo-01p**: Web IDE layout: file tree + Monaco + terminal
- **todo-g21**: Terminal session page in dashboard

### Timeline

- **Created:** 12/20/2025

