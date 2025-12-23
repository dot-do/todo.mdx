---
id: todo-42j
title: "Wire protocol types and constants"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-20T22:59:29.401Z"
updatedAt: "2025-12-20T23:30:57.249Z"
closedAt: "2025-12-20T23:30:57.249Z"
source: "beads"
dependsOn: ["todo-nsd"]
blocks: ["todo-e1g", "todo-mqg", "todo-r1i"]
---

# Wire protocol types and constants

Define shared TypeScript types and constants for the stdio-over-websocket wire protocol.

**IMPORTANT:** This protocol must work for BOTH:
1. **Bun CLI** (`sbx-stdio`) - native binary handling
2. **Browser/xterm.js** - via ArrayBuffer

## Stream IDs (Binary Protocol)
```typescript
export const STREAM_STDOUT = 0x01;
export const STREAM_STDERR = 0x02;
```

## Control Messages (JSON text)
```typescript
// Client → Server
type ResizeMessage = { type: 'resize'; cols: number; rows: number };
type SignalMessage = { type: 'signal'; signal: string };

// Server → Client  
type ExitMessage = { type: 'exit'; code: number };
```

## Helper functions
```typescript
// Pack binary output with stream ID
export function pack(streamId: number, chunk: Uint8Array): Uint8Array {
  const out = new Uint8Array(1 + chunk.byteLength);
  out[0] = streamId;
  out.set(chunk, 1);
  return out;
}

// Unpack stream ID from binary
export function unpack(data: Uint8Array): { streamId: number; payload: Uint8Array } {
  return {
    streamId: data[0],
    payload: data.subarray(1)
  };
}
```

## Browser Compatibility
The xterm.js component (from `todo-5zv`) currently uses JSON `{type, data}`. Options:
1. **Migrate to binary** - More efficient, xterm handles ArrayBuffer fine
2. **Support both** - Server can detect text vs binary and respond accordingly
3. **Wrapper** - Browser client wraps binary in a helper

**Recommendation:** Use binary protocol, browser handles it via `ws.binaryType = 'arraybuffer'`

## Location
`packages/sandbox-stdio/src/protocol.ts` - shared between:
- `sandbox/stdio-ws.ts` (server)
- `packages/sbx-cli/` (Bun CLI)
- `packages/dashboard/` (xterm.js component)

### Related Issues

**Depends on:**
- [todo-nsd](./todo-nsd.md)

**Blocks:**
- [todo-e1g](./todo-e1g.md)
- [todo-mqg](./todo-mqg.md)
- [todo-r1i](./todo-r1i.md)