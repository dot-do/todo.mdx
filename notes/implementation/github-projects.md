# GitHub Projects Integration

This document describes the GitHub Projects integration for syncing cross-repo roadmaps with roadmap.mdx epics.

## Overview

The worker now supports GitHub Projects (v2) integration, allowing you to:

- Track cross-repo work using GitHub Projects
- Sync project items (issues/PRs) with roadmap.mdx epics
- Map project milestones to repo-specific milestones
- Track project field values (Status, Priority, Iteration, etc.)

## Architecture

### Components

1. **GitHub App Permissions** - Configured in `.github/app-manifest.json`
   - `repository_projects: write` - Read/write repo-level projects
   - `organization_projects: write` - Read/write org-level projects

2. **Webhook Handlers** - In `worker/src/index.ts`
   - `projects_v2` - Handles project-level events (created, edited, deleted, etc.)
   - `projects_v2_item` - Handles project item events (created, edited, reordered, archived, etc.)

3. **ProjectDO** - Durable Object at `worker/src/do/project.ts`
   - Manages sync state for a single GitHub Project
   - Stores project metadata, items, fields, and milestone mappings
   - Uses XState for coordinated cross-repo sync

4. **API Routes** - Protected endpoints for project management
   - `GET /api/projects/:nodeId` - Get project info
   - `GET /api/projects/:nodeId/items` - List project items
   - `GET /api/projects/:nodeId/fields` - List project fields
   - `POST /api/projects/:nodeId/sync` - Trigger manual sync
   - `POST /api/projects/:nodeId/repos` - Link a repo to the project

## Data Model

### Project Metadata

Stored in `project_metadata` table (single row per project):

```sql
CREATE TABLE project_metadata (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  github_node_id TEXT NOT NULL,
  number INTEGER,
  title TEXT,
  short_description TEXT,
  owner TEXT,
  public INTEGER,
  closed INTEGER,
  github_created_at TEXT,
  github_updated_at TEXT,
  last_sync_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Project Items

Stored in `project_items` table:

```sql
CREATE TABLE project_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_item_id TEXT NOT NULL UNIQUE,
  github_content_id TEXT,
  content_type TEXT NOT NULL,
  content_id INTEGER,
  repo_full_name TEXT,
  title TEXT NOT NULL,
  status TEXT,
  priority TEXT,
  iteration TEXT,
  milestone_title TEXT,
  is_archived INTEGER DEFAULT 0,
  github_created_at TEXT,
  github_updated_at TEXT,
  last_sync_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Project Fields

Stored in `project_fields` table:

```sql
CREATE TABLE project_fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_field_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  data_type TEXT NOT NULL,
  options TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Milestone Mappings

Maps a single roadmap milestone to multiple repo-specific milestones:

```sql
CREATE TABLE milestone_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  repo_milestones TEXT NOT NULL, -- JSON array
  due_on TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## Webhook Flow

### Project Events

When a project is created, edited, or deleted:

1. GitHub sends `projects_v2` webhook to `/github/webhook`
2. `handleProject()` extracts project metadata
3. ProjectDO stores/updates metadata in `project_metadata` table
4. Event logged in `sync_log` table

### Project Item Events

When a project item is created, edited, archived, or reordered:

1. GitHub sends `projects_v2_item` webhook to `/github/webhook`
2. `handleProjectItem()` extracts item data and field values
3. ProjectDO stores/updates item in `project_items` table
4. Field values (Status, Priority, Iteration, Milestone) are extracted and stored
5. Event logged in `sync_log` table

### Field Value Changes

When a field value changes (e.g., Status: Todo → In Progress):

1. Webhook includes `changes.field_value` with:
   - `field_name` - Field name (e.g., "Status")
   - `field_type` - Field type (e.g., "SINGLE_SELECT")
   - `from` - Previous value
   - `to` - New value
2. ProjectDO updates the corresponding field in `project_items`

## API Usage

### Get Project Info

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://api.todo.mdx.do/api/projects/PVT_kwDOABcD1M4Ab2Cd
```

Response:
```json
{
  "project": {
    "github_node_id": "PVT_kwDOABcD1M4Ab2Cd",
    "number": 1,
    "title": "Q1 2025 Roadmap",
    "owner": "todo-mdx",
    "linkedRepos": 3,
    "items": 42,
    "fields": 6,
    "milestoneMappings": 4
  }
}
```

### List Project Items

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://api.todo.mdx.do/api/projects/PVT_kwDOABcD1M4Ab2Cd/items
```

Response:
```json
[
  {
    "github_item_id": "PVTI_lADOABcD1M4Ab2CdzgABcDe",
    "content_type": "Issue",
    "repo_full_name": "todo-mdx/core",
    "title": "Add GitHub Projects sync",
    "status": "In Progress",
    "priority": "P1",
    "iteration": "Sprint 3",
    "milestone_title": "v1.0",
    "is_archived": 0
  }
]
```

### Trigger Manual Sync

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://api.todo.mdx.do/api/projects/PVT_kwDOABcD1M4Ab2Cd/sync
```

## Roadmap.mdx Integration

### Epic Mapping

Project items with `milestone_title` are mapped to roadmap.mdx epics:

1. `milestone_title` in project item → Epic title in ROADMAP.mdx
2. Multiple repo milestones can map to the same epic
3. Epic progress calculated from project item statuses

### Example ROADMAP.mdx

```mdx
---
project: PVT_kwDOABcD1M4Ab2Cd
---

# 2025 Roadmap

## Q1: Core Features

<Epic title="v1.0" milestone="v1.0">
  <Epic.Progress source="github-project" />
  <Epic.Items repo="todo-mdx/core" milestone="v1.0" />
  <Epic.Items repo="todo-mdx/cli" milestone="v1.0" />
</Epic>

## Q2: Advanced Features

<Epic title="v2.0" milestone="v2.0">
  <Epic.Progress source="github-project" />
  <Epic.Items repo="todo-mdx/core" milestone="v2.0" />
  <Epic.Items repo="todo-mdx/worker" milestone="v2.0" />
</Epic>
```

### Milestone Mapping API

Create a milestone mapping:

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "title": "v1.0",
    "dueOn": "2025-03-31",
    "repoMilestones": [
      { "fullName": "todo-mdx/core", "milestoneNumber": 1 },
      { "fullName": "todo-mdx/cli", "milestoneNumber": 2 }
    ]
  }' \
  https://api.todo.mdx.do/api/projects/PVT_kwDOABcD1M4Ab2Cd/milestones
```

## State Machine

ProjectDO uses XState for coordinated cross-repo sync:

- **idle** - No active sync
- **syncing** - Processing sync event
- **retrying** - Retrying after error (2s delay)
- **error** - Too many errors (>= 5)

Events:
- `ENQUEUE` - Add sync event to queue
- `SYNC_COMPLETE` - Current sync completed
- `SYNC_ERROR` - Sync failed
- `RESET` - Clear errors and return to idle

## Future Enhancements

1. **GraphQL API Integration** - Fetch full project data via GraphQL
2. **Field Sync** - Automatically discover and sync custom fields
3. **Bi-directional Sync** - Update GitHub from roadmap.mdx
4. **Progress Tracking** - Real-time epic progress updates
5. **Dependency Graphs** - Sync project item dependencies

## Debugging

### View Sync Logs

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://api.todo.mdx.do/api/projects/PVT_kwDOABcD1M4Ab2Cd/status
```

Response includes recent sync log:
```json
{
  "project": {...},
  "linkedRepos": 3,
  "items": 42,
  "recentSyncs": [
    {
      "entity_type": "item",
      "entity_id": "PVTI_lADOABcD1M4Ab2CdzgABcDe",
      "action": "updated",
      "status": "success",
      "created_at": "2025-12-20T12:34:56Z"
    }
  ]
}
```

### Common Issues

1. **Missing Permissions** - Ensure GitHub App has `organization_projects: write`
2. **Webhook Not Received** - Check webhook delivery in GitHub App settings
3. **Field Values Not Updating** - Verify field names match exactly (case-sensitive)
4. **Stale Data** - Trigger manual sync to force refresh
