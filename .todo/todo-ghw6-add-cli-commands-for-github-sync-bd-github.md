---
id: todo-ghw6
title: "Add CLI commands for GitHub sync (bd github)"
state: open
priority: 3
type: task
labels: ["cli", "github-app", "phase-3"]
createdAt: "2025-12-23T13:37:28.769Z"
updatedAt: "2025-12-23T13:37:28.769Z"
source: "beads"
---

# Add CLI commands for GitHub sync (bd github)

Add CLI commands to beads for GitHub App integration.

## Commands

### `bd github connect`
Connect current repo to GitHub App.
```bash
bd github connect [--owner=...] [--repo=...]
# Opens browser for GitHub App installation
# Stores installation ID in .beads/config
```

### `bd github sync`
Trigger manual sync.
```bash
bd github sync [--direction=both|push|pull]
# pull: GitHub → Beads
# push: Beads → GitHub
# both: Bidirectional with conflict resolution
```

### `bd github status`
Check sync health.
```bash
bd github status
# Output:
# Connected: anthropic/claude-code
# Last sync: 2 minutes ago
# Status: idle
# Issues synced: 42
# Pending changes: 3
```

### `bd github disconnect`
Remove GitHub connection.
```bash
bd github disconnect
# Removes installation, keeps local issues
```

## Implementation
Add to beads-workflows CLI or as separate package.

### Related Issues

**Depends on:**
- **todo-qu6s**
- **todo-v5yv**

### Timeline

- **Created:** 12/23/2025
- **Updated:** 12/23/2025
