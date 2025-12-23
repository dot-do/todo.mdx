---
id: todo-8ufg
title: "RepoDO as bidirectional sync engine between GitHub Issues and beads"
state: closed
priority: 1
type: epic
labels: ["architecture", "sync", "worker"]
createdAt: "2025-12-20T23:30:59.907Z"
updatedAt: "2025-12-22T11:45:56.740Z"
closedAt: "2025-12-22T11:45:56.740Z"
source: "beads"
---

# RepoDO as bidirectional sync engine between GitHub Issues and beads

Make RepoDO the source of truth and sync coordinator between GitHub Issues and beads JSONL.

## Architecture

```
GitHub Issues ←──→ RepoDO (source of truth) ←──→ .beads/issues.jsonl
      │                      │                         │
      │                      ▼                         │
      │               SQLite DB                        │
      │            (canonical state)                   │
      │                      │                         │
      ▼                      ▼                         ▼
  webhook in            MCP tools              push webhook in
  webhook out           query here             commit & push out
```

## Key Design Decisions

1. **RepoDO owns canonical state** - SQLite in the DO is the source of truth
2. **Schema matches beads exactly** - issues, dependencies, labels, comments tables
3. **No Drizzle needed** - raw sql.exec() is sufficient for simple CRUD
4. **No complex sync logic** - direct upserts, last-write-wins
5. **Remove Payload Issues/Milestones** - DO replaces them

## Data Flow

**GitHub → DO → beads:**
1. GitHub Issue webhook arrives
2. RepoDO upserts to SQLite
3. RepoDO commits updated issues.jsonl to repo

**beads → DO → GitHub:**
1. Push webhook with .beads/issues.jsonl changes
2. RepoDO parses JSONL, upserts to SQLite
3. RepoDO creates/updates GitHub Issues via API

## Benefits

- Single source of truth (no sync drift)
- MCP tools query DO directly (fast)
- Simpler than current XState machine
- beads CLI works locally, syncs via git push

### Related Issues

**Blocks:**
- **todo-0tb9**
- **todo-3zw8**
- **todo-5b8a**
- **todo-b3ya**
- **todo-fnmo**
- **todo-gzn5**
- **todo-wds0**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/22/2025
- **Closed:** 12/22/2025
