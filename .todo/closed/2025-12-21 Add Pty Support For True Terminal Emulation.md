---
id: todo-kkqx
title: "Add PTY support for true terminal emulation"
state: closed
priority: 2
type: feature
labels: ["sandbox", "terminal"]
createdAt: "2025-12-21T22:45:20.087Z"
updatedAt: "2025-12-23T10:08:49.106Z"
closedAt: "2025-12-23T10:08:49.106Z"
source: "beads"
---

# Add PTY support for true terminal emulation

The current sandbox implementation uses pipes instead of PTY, which means:
- Terminal resize signals are ignored
- No proper terminal emulation (raw vs cooked mode)
- Some interactive CLI tools may not work correctly

The stdio-ws.ts has a comment: "resize is ignored in pipe mode (requires PTY)"