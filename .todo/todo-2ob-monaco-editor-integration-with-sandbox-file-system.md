---
id: todo-2ob
title: "Monaco editor integration with sandbox file system"
state: closed
priority: 2
type: feature
labels: [editor, monaco, sandbox]
---

# Monaco editor integration with sandbox file system

Integrate Monaco editor with Cloudflare Sandbox file system for a full editing experience.

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                     Browser                                 │
│  ┌──────────────┐  ┌─────────────────┐  ┌───────────────┐ │
│  │  File Tree   │  │  Monaco Editor  │  │   Terminal    │ │
│  │              │  │                 │  │   (xterm.js)  │ │
│  └──────┬───────┘  └────────┬────────┘  └───────────────┘ │
│         │                   │                              │
│         └─────────┬─────────┘                              │
│                   │ WebSocket                              │
└───────────────────┼────────────────────────────────────────┘
                    │
          ┌─────────▼─────────┐
          │  Cloudflare Worker │
          │   (file ops API)   │
          └─────────┬─────────┘
                    │
          ┌─────────▼─────────┐
          │     Sandbox       │
          │  ┌─────────────┐  │
          │  │ /workspace  │  │
          │  │   (repo)    │  │
          │  └─────────────┘  │
          └───────────────────┘
```

## Sandbox File API Wrapper

```typescript
// worker/src/api/files.ts
import { Hono } from 'hono'

const files = new Hono<{ Bindings: Env }>()

// List directory
files.get('/list', async (c) => {
  const path = c.req.query('path') || '/workspace'
  const sessionId = c.req.query('session')
  
  const sandbox = await getSandboxForSession(c.env, sessionId)
  const result = await sandbox.exec(`ls -la --color=never ${path}`)
  
  // Parse ls output into structured data
  const entries = parseLsOutput(result.stdout)
  
  return c.json({ path, entries })
})

// Read file
files.get('/read', async (c) => {
  const path = c.req.query('path')!
  const sessionId = c.req.query('session')
  
  const sandbox = await getSandboxForSession(c.env, sessionId)
  const file = await sandbox.readFile(path)
  
  return c.json({
    path,
    content: file.content,
    encoding: file.encoding
  })
})

// Write file
files.post('/write', async (c) => {
  const { path, content } = await c.req.json()
  const sessionId = c.req.query('session')
  
  const sandbox = await getSandboxForSession(c.env, sessionId)
  await sandbox.writeFile(path, content)
  
  return c.json({ success: true, path })
})

// Create directory
files.post('/mkdir', async (c) => {
  const { path } = await c.req.json()
  const sessionId = c.req.query('session')
  
  const sandbox = await getSandboxForSession(c.env, sessionId)
  await sandbox.mkdir(path, { recursive: true })
  
  return c.json({ success: true, path })
})

// Delete file/directory
files.delete('/delete', async (c) => {
  const path = c.req.query('path')!
  const sessionId = c.req.query('session')
  
  const sandbox = await getSandboxForSession(c.env, sessionId)
  await sandbox.exec(`rm -rf ${path}`)
  
  return c.json({ success: true })
})

// Rename/move
files.post('/rename', async (c) => {
  const { from, to } = await c.req.json()
  const sessionId = c.req.query('session')
  
  const sandbox = await getSandboxForSession(c.env, sessionId)
  await sandbox.exec(`mv ${from} ${to}`)
  
  return c.json({ success: true, from, to })
})

export { files }
```

## Monaco Integration

```tsx
// packages/dashboard/src/components/Editor.tsx
import Editor from '@monaco-editor/react'

interface SandboxFile {
  path: string
  content: string
  language?: string
}

function SandboxEditor({ sessionId, file, onSave }: Props) {
  const [content, setContent] = useState(file.content)
  const [isDirty, setIsDirty] = useState(false)

  const handleSave = async () => {
    await fetch(`/api/files/write?session=${sessionId}`, {
      method: 'POST',
      body: JSON.stringify({ path: file.path, content })
    })
    setIsDirty(false)
    onSave?.()
  }

  // Cmd+S / Ctrl+S to save
  const handleEditorMount = (editor: any, monaco: any) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, handleSave)
  }

  return (
    <div className="h-full relative">
      {isDirty && (
        <div className="absolute top-2 right-2 z-10">
          <span className="text-yellow-500 text-sm">Unsaved</span>
        </div>
      )}
      <Editor
        height="100%"
        language={detectLanguage(file.path)}
        value={content}
        onChange={(v) => {
          setContent(v || '')
          setIsDirty(true)
        }}
        onMount={handleEditorMount}
        theme="vs-dark"
        options={{
          minimap: { enabled: true },
          fontSize: 14,
          fontFamily: 'JetBrains Mono, monospace',
          automaticLayout: true,
        }}
      />
    </div>
  )
}
```

## File Change Detection

Watch for file changes (Claude editing files):
```typescript
// Poll for changes or use inotify
async function watchFiles(sandbox: Sandbox, paths: string[]) {
  // Use inotifywait if available
  const stream = await sandbox.execStream(
    `inotifywait -m -r -e modify,create,delete /workspace`
  )
  
  for await (const event of parseSSEStream(stream)) {
    if (event.type === 'stdout') {
      // Parse inotify output and notify editor
      const change = parseInotifyEvent(event.data)
      broadcastFileChange(change)
    }
  }
}
```

## Language Detection
```typescript
function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rs: 'rust',
    go: 'go',
    md: 'markdown',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    css: 'css',
    html: 'html',
    sql: 'sql',
  }
  return map[ext || ''] || 'plaintext'
}
```

### Related Issues

**Blocks:**
- **todo-01p**: Web IDE layout: file tree + Monaco + terminal
- **todo-1zv**: LSP support via language servers in sandbox

### Timeline

- **Created:** 12/20/2025

