---
id: todo-g21
title: "Terminal session page in dashboard"
state: closed
priority: 2
type: feature
labels: [dashboard, terminal, ui]
---

# Terminal session page in dashboard

Create a full-page terminal experience in the dashboard for running Claude Code sessions.

## Routes
- `/terminal/new` - Start new session (select repo, describe task)
- `/terminal/:sessionId` - Active terminal session
- `/terminal/history` - Past sessions with logs

## UI Design

### New Session Page
```tsx
// apps/todo.mdx.do/app/terminal/new/page.tsx
export default function NewTerminalSession() {
  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1>Start Claude Code Session</h1>
      
      <form onSubmit={handleSubmit}>
        <RepoSelector 
          value={repo} 
          onChange={setRepo} 
        />
        
        <textarea
          placeholder="Describe the task for Claude..."
          value={task}
          onChange={(e) => setTask(e.target.value)}
          className="w-full h-32"
        />
        
        <Button type="submit">
          Launch Terminal
        </Button>
      </form>
    </div>
  )
}
```

### Active Session Page
```tsx
// apps/todo.mdx.do/app/terminal/[sessionId]/page.tsx
export default function TerminalSession({ params }) {
  const { sessionId } = params
  const wsUrl = `wss://todo.mdx.do/api/terminal/${sessionId}`

  return (
    <div className="h-screen flex flex-col">
      {/* Header with session info */}
      <header className="h-12 border-b flex items-center px-4">
        <span className="text-sm text-muted-foreground">
          Session: {sessionId}
        </span>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            Copy Output
          </Button>
          <Button variant="destructive" size="sm" onClick={handleTerminate}>
            Terminate
          </Button>
        </div>
      </header>
      
      {/* Terminal fills remaining space */}
      <main className="flex-1">
        <Terminal 
          wsUrl={wsUrl}
          onConnect={() => setStatus('connected')}
          onDisconnect={() => setStatus('disconnected')}
        />
      </main>
    </div>
  )
}
```

## Features
- Full-screen terminal mode (F11 or button)
- Session sharing via URL
- Output download as text/ANSI
- Reconnect on disconnect
- Session timeout warning

### Timeline

- **Created:** 12/20/2025

