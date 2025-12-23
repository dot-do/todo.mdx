---
id: todo-ryxq
title: "Wire ClaudeSandbox to ClaudeCodeAgent"
state: closed
priority: 0
type: task
labels: ["agents", "p0-blocker", "sandbox"]
createdAt: "2025-12-22T00:24:04.333Z"
updatedAt: "2025-12-22T08:41:46.404Z"
closedAt: "2025-12-22T08:41:46.404Z"
source: "beads"
---

# Wire ClaudeSandbox to ClaudeCodeAgent

Connect the existing ClaudeSandbox Durable Object infrastructure to the ClaudeCodeAgent implementation.

## Current State
- `worker/src/sandbox/claude.ts` - Full sandbox infrastructure exists
- `worker/src/agents/impl/claude-code.ts` - Placeholder that returns "not implemented"

## Required Changes
1. Import ClaudeSandbox DO in claude-code.ts
2. Implement `execute()` to:
   - Get DO stub via env.CLAUDE_SANDBOX.get()
   - Call sandbox.clone() with repo URL
   - Call sandbox.execute() with task prompt
   - Stream results via WebSocket or SSE
3. Handle sandbox lifecycle (timeout, cleanup)
4. Return structured results (files changed, git diff, errors)

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/22/2025
- **Closed:** 12/22/2025
