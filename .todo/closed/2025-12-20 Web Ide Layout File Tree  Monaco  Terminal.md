---
id: todo-01p
title: "Web IDE layout: file tree + Monaco + terminal"
state: closed
priority: 2
type: feature
labels: ["ide", "layout", "ui"]
createdAt: "2025-12-20T19:52:43.234Z"
updatedAt: "2025-12-20T20:26:29.046Z"
closedAt: "2025-12-20T20:26:29.046Z"
source: "beads"
dependsOn: ["todo-5zv", "todo-2ob", "todo-439"]
blocks: ["todo-rpf"]
---

# Web IDE layout: file tree + Monaco + terminal

Create the full IDE layout combining file tree, Monaco editor, and terminal.

## Layout Design

```
┌────────────────────────────────────────────────────────────────┐
│  [todo.mdx]  Session: abc123  │  👤 User  │  🤖 Claude: working │
├──────────┬─────────────────────────────────────────────────────┤
│          │  src/index.ts                              [x]      │
│ EXPLORER │─────────────────────────────────────────────────────│
│          │                                                     │
│ ▼ src    │  import { Hono } from 'hono'                        │
│   index  │                                                     │
│   utils  │  const app = new Hono()                             │
│ ▼ tests  │                                                     │
│   app.te │  app.get('/', (c) => {                              │
│ package. │    return c.text('Hello!')                          │
│ tsconfig │  })                                                 │
│          │                                                     │
├──────────┴─────────────────────────────────────────────────────┤
│ TERMINAL                                          [+] [□] [×]  │
│──────────────────────────────────────────────────────────────────
│ $ claude-code --task "add user authentication"                 │
│ ⠋ Analyzing codebase...                                        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Component Structure

```tsx
// apps/todo.mdx.do/app/ide/[sessionId]/page.tsx
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'

export default function IDEPage({ params }: { params: { sessionId: string } }) {
  const { sessionId } = params
  const [openFiles, setOpenFiles] = useState<string[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [fileContents, setFileContents] = useState<Map<string, string>>(new Map())

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-10 border-b flex items-center px-4 gap-4">
        <Logo />
        <span className="text-sm text-muted-foreground">
          Session: {sessionId.slice(0, 8)}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <SessionStatus sessionId={sessionId} />
          <ClaudeStatus sessionId={sessionId} />
        </div>
      </header>

      {/* Main IDE Area */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* File Tree */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={40}>
          <FileTree
            sessionId={sessionId}
            selectedPath={activeFile}
            onSelectFile={(path) => {
              if (!openFiles.includes(path)) {
                setOpenFiles([...openFiles, path])
              }
              setActiveFile(path)
              loadFile(path)
            }}
          />
        </ResizablePanel>

        <ResizableHandle />

        {/* Editor + Terminal */}
        <ResizablePanel defaultSize={80}>
          <ResizablePanelGroup direction="vertical">
            {/* Editor Area */}
            <ResizablePanel defaultSize={70} minSize={30}>
              <div className="h-full flex flex-col">
                {/* Tabs */}
                <div className="h-9 border-b flex items-center overflow-x-auto">
                  {openFiles.map(file => (
                    <EditorTab
                      key={file}
                      path={file}
                      active={file === activeFile}
                      dirty={isDirty(file)}
                      onClick={() => setActiveFile(file)}
                      onClose={() => closeFile(file)}
                    />
                  ))}
                </div>

                {/* Monaco Editor */}
                <div className="flex-1">
                  {activeFile && (
                    <SandboxEditor
                      sessionId={sessionId}
                      file={{
                        path: activeFile,
                        content: fileContents.get(activeFile) || ''
                      }}
                      onSave={() => markClean(activeFile)}
                      onChange={(content) => updateContent(activeFile, content)}
                    />
                  )}
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Terminal */}
            <ResizablePanel defaultSize={30} minSize={10}>
              <div className="h-full flex flex-col">
                <div className="h-8 border-b flex items-center px-2 gap-2">
                  <span className="text-xs font-medium">TERMINAL</span>
                  <div className="ml-auto flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Plus size={12} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Maximize2 size={12} />
                    </Button>
                  </div>
                </div>
                <div className="flex-1">
                  <Terminal
                    wsUrl={`wss://todo.mdx.do/api/terminal/${sessionId}`}
                  />
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
```

## Tab Component

```tsx
function EditorTab({ path, active, dirty, onClick, onClose }: TabProps) {
  const filename = path.split('/').pop()
  
  return (
    <div
      className={cn(
        'h-full px-3 flex items-center gap-2 border-r cursor-pointer',
        active ? 'bg-background' : 'bg-muted/50'
      )}
      onClick={onClick}
    >
      <FileIcon filename={filename!} size={14} />
      <span className="text-sm">{filename}</span>
      {dirty && <span className="w-2 h-2 rounded-full bg-yellow-500" />}
      <button
        className="ml-1 hover:bg-muted rounded p-0.5"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      >
        <X size={12} />
      </button>
    </div>
  )
}
```

## Keyboard Shortcuts

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd+S - Save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      saveCurrentFile()
    }
    // Cmd+P - Quick open
    if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
      e.preventDefault()
      openQuickOpen()
    }
    // Cmd+` - Toggle terminal
    if ((e.metaKey || e.ctrlKey) && e.key === '`') {
      e.preventDefault()
      toggleTerminal()
    }
    // Cmd+B - Toggle sidebar
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault()
      toggleSidebar()
    }
  }
  
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [])
```

## Session State Sync

Keep editor in sync with Claude's changes:
```typescript
// Subscribe to file changes from sandbox
useEffect(() => {
  const ws = new WebSocket(`wss://todo.mdx.do/api/files/watch?session=${sessionId}`)
  
  ws.onmessage = (e) => {
    const { type, path, content } = JSON.parse(e.data)
    
    if (type === 'modified' && openFiles.includes(path)) {
      // File was modified by Claude
      if (!isDirty(path)) {
        // Auto-reload if no local changes
        setFileContents(prev => new Map(prev).set(path, content))
      } else {
        // Show conflict dialog
        showConflictDialog(path, content)
      }
    }
    
    if (type === 'created' || type === 'deleted') {
      refreshFileTree()
    }
  }
  
  return () => ws.close()
}, [sessionId, openFiles])
```

### Related Issues

**Depends on:**
- [todo-5zv](./todo-5zv.md)
- [todo-2ob](./todo-2ob.md)
- [todo-439](./todo-439.md)

**Blocks:**
- [todo-rpf](./todo-rpf.md)