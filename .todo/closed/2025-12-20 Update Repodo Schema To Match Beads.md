---
id: todo-3zw8
title: "Update RepoDO schema to match beads"
state: closed
priority: 1
type: task
labels: ["sync", "worker"]
createdAt: "2025-12-20T23:31:31.019Z"
updatedAt: "2025-12-20T23:36:07.874Z"
closedAt: "2025-12-20T23:36:07.874Z"
source: "beads"
dependsOn: ["todo-8ufg"]
blocks: ["todo-0tb9", "todo-5b8a", "todo-fnmo", "todo-wds0"]
---

# Update RepoDO schema to match beads

Replace current RepoDO schema with beads-compatible tables.

## Current Schema (to remove)
```sql
issues (id, github_id, github_number, beads_id, title, body, state, ...)
milestones (...)
sync_log (...)
```

## New Schema (matching beads)
```sql
CREATE TABLE issues (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  design TEXT NOT NULL DEFAULT '',
  acceptance_criteria TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  priority INTEGER NOT NULL DEFAULT 2,
  issue_type TEXT NOT NULL DEFAULT 'task',
  assignee TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  closed_at DATETIME,
  close_reason TEXT DEFAULT '',
  external_ref TEXT,
  -- Sync metadata (not in beads)
  github_number INTEGER,
  github_id INTEGER,
  last_sync_at DATETIME
);

CREATE TABLE dependencies (
  issue_id TEXT NOT NULL,
  depends_on_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'blocks',
  created_at DATETIME NOT NULL,
  created_by TEXT NOT NULL,
  PRIMARY KEY (issue_id, depends_on_id)
);

CREATE TABLE labels (
  issue_id TEXT NOT NULL,
  label TEXT NOT NULL,
  PRIMARY KEY (issue_id, label)
);

CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id TEXT NOT NULL,
  author TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at DATETIME NOT NULL
);
```

## Files to modify
- `worker/src/do/repo.ts` - update ensureInitialized()

### Related Issues

**Depends on:**
- [todo-8ufg](./todo-8ufg.md)

**Blocks:**
- [todo-0tb9](./todo-0tb9.md)
- [todo-5b8a](./todo-5b8a.md)
- [todo-fnmo](./todo-fnmo.md)
- [todo-wds0](./todo-wds0.md)