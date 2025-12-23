---
id: todo-0ot
title: "tmux-based multi-pane terminal in sandbox"
state: closed
priority: 2
type: feature
labels: ["sandbox", "terminal", "tmux"]
createdAt: "2025-12-20T19:47:40.470Z"
updatedAt: "2025-12-23T10:08:49.118Z"
closedAt: "2025-12-23T10:08:49.118Z"
source: "beads"
dependsOn: ["todo-42f"]
blocks: ["todo-1u3"]
---

# tmux-based multi-pane terminal in sandbox

Run tmux inside the sandbox to enable multi-pane terminals and session persistence.

## Why tmux?
- Battle-tested terminal multiplexer
- Native support for multiple panes/windows
- Session persistence (survives disconnects)
- Shared sessions built-in
- Scriptable via tmux commands

## Features to Expose

### Pane Management
```typescript
interface TmuxSession {
  // Create/manage panes
  splitHorizontal(): Promise<string>  // Returns pane ID
  splitVertical(): Promise<string>
  closePane(paneId: string): Promise<void>
  
  // Navigate
  selectPane(paneId: string): Promise<void>
  
  // Resize
  resizePane(paneId: string, cols: number, rows: number): Promise<void>
  
  // Get layout for rendering
  getLayout(): Promise<TmuxLayout>
}

interface TmuxLayout {
  windows: Array<{
    id: string
    name: string
    panes: Array<{
      id: string
      x: number
      y: number
      width: number
      height: number
      active: boolean
    }>
  }>
}
```

### Sandbox Setup
```typescript
async function setupTmuxSandbox(sandbox: Sandbox) {
  // Install tmux if needed
  await sandbox.exec('apt-get update && apt-get install -y tmux')
  
  // Custom tmux config for better WebSocket integration
  await sandbox.writeFile('/root/.tmux.conf', `
    # Enable mouse
    set -g mouse on
    
    # Better colors
    set -g default-terminal "xterm-256color"
    set -ga terminal-overrides ",xterm-256color:Tc"
    
    # Status bar showing pane info
    set -g status-right '#[fg=green]#{pane_current_command}'
    
    # Don't rename windows automatically
    set-option -g allow-rename off
  `)

  // Start session
  await sandbox.exec('tmux new-session -d -s main -n workspace')
  
  return sandbox
}
```

### Multi-Pane WebSocket Protocol
```typescript
// Client sends pane-targeted input
interface PaneInput {
  type: 'stdin'
  paneId: string
  data: string
}

// Server sends pane-tagged output
interface PaneOutput {
  type: 'stdout'
  paneId: string
  data: string
}

// Layout updates
interface LayoutUpdate {
  type: 'layout'
  layout: TmuxLayout
}
```

### Browser Rendering
```tsx
function TmuxTerminal({ sessionId }) {
  const [layout, setLayout] = useState<TmuxLayout | null>(null)
  const terminals = useRef<Map<string, XTerminal>>(new Map())

  // Render panes according to layout
  return (
    <div className="relative h-full w-full">
      {layout?.windows[0]?.panes.map(pane => (
        <div
          key={pane.id}
          style={{
            position: 'absolute',
            left: `${pane.x}%`,
            top: `${pane.y}%`,
            width: `${pane.width}%`,
            height: `${pane.height}%`,
          }}
        >
          <XTermPane
            paneId={pane.id}
            active={pane.active}
            onData={(data) => sendToPane(pane.id, data)}
          />
        </div>
      ))}
    </div>
  )
}
```

## Common Layouts

### User + Claude Side-by-Side
```
┌─────────────────┬─────────────────┐
│                 │                 │
│   User Shell    │  Claude Code    │
│                 │                 │
└─────────────────┴─────────────────┘
```

### User + Claude + Logs
```
┌─────────────────┬─────────────────┐
│                 │                 │
│   User Shell    │  Claude Code    │
│                 │                 │
├─────────────────┴─────────────────┤
│          tail -f logs             │
└───────────────────────────────────┘
```

### IDE-like Layout
```
┌───────────┬───────────────────────┐
│           │                       │
│  Files    │      Editor           │
│  (tree)   │      (neovim)         │
│           │                       │
├───────────┴───────────────────────┤
│           Terminal                │
└───────────────────────────────────┘
```

### Related Issues

**Depends on:**
- [todo-42f](./todo-42f.md)

**Blocks:**
- [todo-1u3](./todo-1u3.md)