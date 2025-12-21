---
id: todo-1zv
title: "LSP support via language servers in sandbox"
state: open
priority: 3
type: feature
labels: [intellisense, lsp, monaco]
---

# LSP support via language servers in sandbox

Run language servers inside the sandbox and connect Monaco to them for intellisense, go-to-definition, etc.

## Why LSP in Sandbox?
- Full intellisense with project context
- Go to definition works on sandbox files
- Type checking, linting in real-time
- Same environment Claude is using

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                             │
│  ┌─────────────────────────────────────────────────────┐│
│  │              Monaco Editor                          ││
│  │         (monaco-languageclient)                     ││
│  └────────────────────┬────────────────────────────────┘│
│                       │ LSP over WebSocket               │
└───────────────────────┼─────────────────────────────────┘
                        │
              ┌─────────▼─────────┐
              │  Cloudflare Worker │
              │   (LSP proxy)      │
              └─────────┬─────────┘
                        │
              ┌─────────▼─────────┐
              │      Sandbox      │
              │  ┌─────────────┐  │
              │  │  tsserver   │  │  ← TypeScript
              │  │  pylsp      │  │  ← Python
              │  │  gopls      │  │  ← Go
              │  │  rust-analy │  │  ← Rust
              │  └─────────────┘  │
              └───────────────────┘
```

## TypeScript/JavaScript LSP

```typescript
// worker/src/lsp/typescript.ts
export async function startTypeScriptLSP(sandbox: Sandbox) {
  // tsserver is included with TypeScript
  await sandbox.exec('npm install -g typescript')
  
  // Start tsserver in LSP mode
  const stream = await sandbox.execStream(
    'npx typescript-language-server --stdio',
    { cwd: '/workspace' }
  )
  
  return stream
}

// Bridge WebSocket to LSP stdio
export async function bridgeLSP(
  ws: WebSocket,
  lspStream: ReadableStream
) {
  // LSP messages are JSON-RPC with Content-Length header
  
  // Browser → sandbox (requests)
  ws.addEventListener('message', (e) => {
    const message = e.data
    // Format as LSP message with Content-Length
    const lspMessage = `Content-Length: ${message.length}\r\n\r\n${message}`
    sandbox.stdin(lspMessage)
  })
  
  // Sandbox → browser (responses)
  for await (const event of parseSSEStream(lspStream)) {
    if (event.type === 'stdout') {
      // Parse LSP message and forward
      const messages = parseLSPMessages(event.data)
      for (const msg of messages) {
        ws.send(msg)
      }
    }
  }
}
```

## Monaco LSP Client Setup

```typescript
// packages/dashboard/src/lib/lsp-client.ts
import { MonacoLanguageClient } from 'monaco-languageclient'
import { toSocket, WebSocketMessageReader, WebSocketMessageWriter } from 'vscode-ws-jsonrpc'

export function connectLSP(
  sessionId: string,
  language: string
): MonacoLanguageClient {
  const url = `wss://todo.mdx.do/api/lsp/${sessionId}/${language}`
  const webSocket = new WebSocket(url)
  
  webSocket.onopen = () => {
    const socket = toSocket(webSocket)
    const reader = new WebSocketMessageReader(socket)
    const writer = new WebSocketMessageWriter(socket)
    
    const client = new MonacoLanguageClient({
      name: `${language} LSP`,
      clientOptions: {
        documentSelector: [{ language }],
        workspaceFolder: {
          uri: 'file:///workspace',
          name: 'workspace'
        }
      },
      connectionProvider: {
        get: () => Promise.resolve({ reader, writer })
      }
    })
    
    client.start()
  }
  
  return client
}
```

## Multi-Language Support

```typescript
// Start LSP servers based on detected languages
async function startLanguageServers(sandbox: Sandbox, languages: string[]) {
  const servers: Map<string, ReadableStream> = new Map()
  
  for (const lang of languages) {
    switch (lang) {
      case 'typescript':
      case 'javascript':
        servers.set(lang, await startTypeScriptLSP(sandbox))
        break
      case 'python':
        await sandbox.exec('pip install python-lsp-server')
        servers.set(lang, await sandbox.execStream('pylsp'))
        break
      case 'go':
        await sandbox.exec('go install golang.org/x/tools/gopls@latest')
        servers.set(lang, await sandbox.execStream('gopls serve'))
        break
      case 'rust':
        await sandbox.exec('rustup component add rust-analyzer')
        servers.set(lang, await sandbox.execStream('rust-analyzer'))
        break
    }
  }
  
  return servers
}
```

## Features Enabled
- Autocomplete with project context
- Hover documentation
- Go to definition (within sandbox)
- Find references
- Rename symbol
- Format document
- Diagnostics (errors, warnings)

## Performance Considerations
- Start LSP lazily when file of that type opened
- Cache LSP state in DO for reconnection
- Consider sharing LSP across sessions for same repo

### Timeline

- **Created:** 12/20/2025

