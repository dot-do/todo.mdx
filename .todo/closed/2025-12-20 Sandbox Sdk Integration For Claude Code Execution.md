---
id: todo-42f
title: "Sandbox SDK integration for Claude Code execution"
state: closed
priority: 1
type: feature
labels: ["claude-code", "sandbox", "terminal"]
createdAt: "2025-12-20T19:42:43.413Z"
updatedAt: "2025-12-20T19:58:08.624Z"
closedAt: "2025-12-20T19:58:08.624Z"
source: "beads"
blocks: ["todo-0ot", "todo-2ob", "todo-439", "todo-nsd", "todo-wm0"]
---

# Sandbox SDK integration for Claude Code execution

Integrate Cloudflare Sandbox SDK to run Claude Code with full PTY support.

## Requirements
- Clone target repo into sandbox
- Configure Claude Code with proper credentials
- Enable PTY for interactive terminal
- Stream stdout/stderr in real-time
- Handle stdin for user input
- Support terminal resize events

## Sandbox Configuration

```typescript
// worker/src/sandbox/claude-terminal.ts
import { Sandbox } from '@cloudflare/sandbox-sdk'

interface ClaudeTerminalConfig {
  repo: string
  branch?: string
  task: string
  githubToken: string
  claudeApiKey: string
}

export async function createClaudeTerminal(
  env: Env,
  config: ClaudeTerminalConfig
) {
  const sandbox = await env.SANDBOX.create({
    image: 'node:20-slim',  // Or custom image with Claude Code pre-installed
    memory: '2GB',
    timeout: 3600,  // 1 hour max
  })

  // Install Claude Code if not in image
  await sandbox.exec('npm install -g @anthropic-ai/claude-code')

  // Clone repo
  await sandbox.exec(`git clone https://x-access-token:${config.githubToken}@github.com/${config.repo}.git /workspace`)
  await sandbox.exec('cd /workspace')

  // Set up Claude credentials
  await sandbox.exec(`export ANTHROPIC_API_KEY="${config.claudeApiKey}"`)

  return sandbox
}

export async function startClaudeSession(
  sandbox: Sandbox,
  task: string,
  options: { cols: number; rows: number }
) {
  // Start Claude Code with PTY
  const stream = await sandbox.execStream(
    `claude-code --task "${task}"`,
    {
      cwd: '/workspace',
      pty: {
        cols: options.cols,
        rows: options.rows,
      },
      env: {
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      }
    }
  )

  return stream
}
```

## PTY Considerations
- Use `xterm-256color` TERM for full color support
- Handle window resize via `sandbox.resize(cols, rows)`
- Buffer partial UTF-8 sequences
- Handle SIGINT/SIGTERM gracefully

## Security
- Sandbox runs in isolated container
- No network access except GitHub API
- Credentials passed via env, not persisted
- Auto-terminate on disconnect/timeout

### Related Issues

**Blocks:**
- [todo-0ot](./todo-0ot.md)
- [todo-2ob](./todo-2ob.md)
- [todo-439](./todo-439.md)
- [todo-nsd](./todo-nsd.md)
- [todo-wm0](./todo-wm0.md)