---
id: todo-r1i
title: "Bun CLI client (sbx-stdio)"
state: closed
priority: 1
type: feature
labels: []
createdAt: "2025-12-20T22:59:29.816Z"
updatedAt: "2025-12-20T23:30:57.371Z"
closedAt: "2025-12-20T23:30:57.371Z"
source: "beads"
---

# Bun CLI client (sbx-stdio)

Implement the Bun CLI that mirrors local stdio to the sandbox WebSocket.

**Features:**
- Convert worker URL to WebSocket URL (https→wss, http→ws)
- Set stdin to raw mode when TTY
- Forward stdin bytes to WS (binary)
- Demux WS binary frames by stream ID (0x01→stdout, 0x02→stderr)
- Handle JSON exit message
- Ctrl+] to exit locally (like telnet)
- Send resize events on terminal resize

**Usage:**
```bash
sbx-stdio https://worker.example/attach --sandbox user-123 --cmd bash
sbx-stdio https://worker.example/attach --sandbox build --cmd bash --arg -lc --arg "npm test"
```

**CLI args:**
- `<worker-url>` - required
- `--sandbox <id>` - sandbox ID (default: 'default')
- `--cmd <cmd>` - command to run (default: 'bash')
- `--arg <x>` - repeatable args
- `--token <t>` - auth token (or use oauth.do flow)

**Files:**
- `packages/sbx-cli/src/index.ts` or `bin/sbx-stdio.ts`

### Related Issues

**Depends on:**
- **todo-42j**
- **todo-nsd**

**Blocks:**
- **todo-7s0**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
