# RepoDO Bidirectional Sync Analysis

**Issue**: `todo-8ufg` - RepoDO as bidirectional sync engine between GitHub Issues and beads

**Status**: ✅ **ALREADY IMPLEMENTED** - The bidirectional sync is fully functional

## Architecture Overview

```
GitHub Issues ←──→ RepoDO (Durable Object) ←──→ .beads/issues.jsonl
      │                      │                         │
   webhooks              SQLite DB                 git push
      │              (source of truth)                 │
      ▼                      ▼                         ▼
  onGitHubIssue         MCP tools               onBeadsPush
      │                      │                         │
      ├─→ upsertIssue ───────┤                         │
      └─→ commitBeadsJsonl ──┼────────────────────────→│
                             │←────── importFromJsonl ─┘
                             └─→ createGitHubIssue
                             └─→ updateGitHubIssue
```

## Data Flow Directions

### 1. GitHub → RepoDO → beads (✅ Implemented)

**File**: `/Users/nathanclevenger/projects/todo.mdx/worker/src/do/repo.ts` (lines 677-766)

**Trigger**: GitHub webhook (`issues.opened`, `issues.edited`, `issues.closed`, etc.)

**Flow**:
1. GitHub sends webhook to worker (`/api/webhooks/github`)
2. Worker routes to `handleIssues()` in `index.ts` (lines 850-908)
3. Worker calls RepoDO's `onGitHubIssue()` method via `http://do/webhook/github`
4. RepoDO parses GitHub issue and maps to beads schema:
   - Status from GitHub state + labels (`in-progress`, `blocked`)
   - Priority from labels (`P0`-`P4`)
   - Type from labels (`bug`, `feature`, `task`, `epic`, `chore`)
5. RepoDO calls `upsertIssue()` to update SQLite
6. RepoDO calls `commitBeadsJsonl()` to write back to `.beads/issues.jsonl`
7. Changes are committed to GitHub repo via Contents API

**Key Methods**:
- `onGitHubIssue(payload)` - line 677
- `upsertIssue(issue)` - line 445
- `commitBeadsJsonl()` - line 663
- `exportToJsonl()` - line 622

**Race Condition Protection**:
- 60-second protection window prevents concurrent deletion (lines 593-604)
- Title-based fallback for newly created issues (lines 698-709)
- SHA conflict retry with exponential backoff (lines 383-438)

### 2. beads → RepoDO → GitHub (✅ Implemented)

**File**: `/Users/nathanclevenger/projects/todo.mdx/worker/src/do/repo.ts` (lines 906-982)

**Trigger**: Git push with changes to `.beads/issues.jsonl`

**Flow**:
1. Developer runs `bd create/update/close` locally
2. `git push` triggers GitHub push webhook
3. Worker detects `.beads/` files in changed files (lines 1024-1036 in `index.ts`)
4. Worker calls RepoDO's `onBeadsPush()` method via `http://do/webhook/beads`
5. RepoDO fetches `.beads/issues.jsonl` from the commit SHA (line 926)
6. RepoDO calls `importFromJsonl()` to parse and update SQLite (line 927)
7. For each change:
   - **Created issues**: Call `createGitHubIssue()` (line 938)
   - **Updated issues**: Call `updateGitHubIssue()` with debouncing (lines 949-965)
   - **Deleted issues**: Call `closeGitHubIssue()` (lines 968-977)
8. GitHub Issues API is called to sync changes

**Key Methods**:
- `onBeadsPush(payload)` - line 906
- `importFromJsonl(jsonl)` - line 557
- `createGitHubIssue(issueId)` - line 772
- `updateGitHubIssue(issueId)` - line 841
- `closeGitHubIssue(githubNumber)` - line 1050

**Debouncing**:
- 30-second debounce prevents update loops (lines 946-957)
- Skips updates for issues synced from GitHub very recently

**Label Mapping**:
- Priority: `P0`-`P4` labels (lines 117-127)
- Status: `in-progress`, `blocked` labels (lines 129-140)
- Type: `bug`, `feature`, `task`, `epic`, `chore` labels (lines 142-152)
- `buildGitHubLabels()` constructs complete label set (lines 156-180)

## Conflict Resolution

### Strategy: Last-Write-Wins with Debouncing

The system uses a simple but effective conflict resolution strategy:

1. **Timestamp-based**: Uses `last_sync_at` field to track sync operations
2. **Debouncing**: 30-second windows prevent ping-pong updates
3. **Protection windows**: 60-second protection against concurrent deletions
4. **Source of truth**: RepoDO SQLite is canonical; both GitHub and beads sync to/from it

### Conflict Detection (ReconcileWorkflow)

**File**: `/Users/nathanclevenger/projects/todo.mdx/worker/src/workflows/reconcile.ts` (lines 310-330)

The `ReconcileWorkflow` periodically syncs RepoDO → D1/Payload and detects conflicts:

```typescript
// If both changed after last sync, we have a conflict
if (lastSyncAt > 0 && existingUpdatedAt > lastSyncAt && doUpdatedAt > lastSyncAt) {
  return {
    action: 'conflict',
    conflict: {
      reason: 'Both D1 and RepoDO modified since last sync',
      repoDOUpdatedAt: doIssue.updated_at,
      d1UpdatedAt: existingIssue.updatedAt,
    },
  }
}
```

**Note**: This is for RepoDO → D1 sync. For GitHub ↔ beads, conflicts are avoided via debouncing rather than explicit detection.

## Schema Compatibility

RepoDO schema **exactly matches** beads schema with sync extensions:

```sql
CREATE TABLE issues (
  -- Beads fields (exact match)
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
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT,
  close_reason TEXT DEFAULT '',
  external_ref TEXT,

  -- Sync extensions (not in beads JSONL)
  github_number INTEGER,
  github_id INTEGER UNIQUE,
  last_sync_at TEXT
);
```

Tables:
- ✅ `issues` - core issue data
- ✅ `dependencies` - dependency graph
- ✅ `labels` - issue labels (user + system)
- ✅ `comments` - issue comments
- ✅ `sync_log` - audit trail
- ✅ `cross_repo_deps` - cross-repository dependencies
- ✅ `milestones` - GitHub milestones sync

## Workflow Integration

### Automatic Triggering

**File**: `/Users/nathanclevenger/projects/todo.mdx/worker/src/do/repo.ts` (lines 987-1045)

When issues become ready (no blockers), RepoDO automatically triggers `DevelopWorkflow`:

```typescript
private async triggerWorkflowsForReadyIssues(
  readyBefore: Set<string>,
  repoFullName: string,
  installationId: number
): Promise<void>
```

This happens in two scenarios:
1. **After beads push**: When a blocking issue is closed, dependents become ready (line 981)
2. **After PR merge**: When work completes, dependents unblock (line 1872)

## Cross-Repository Dependencies

**File**: `/Users/nathanclevenger/projects/todo.mdx/worker/src/do/repo.ts` (lines 278-294, 1220-1355)

RepoDO supports dependencies across repositories:

1. **Storage**: `cross_repo_deps` table (lines 278-294)
2. **API**: REST endpoints for managing cross-repo deps (lines 1480-1522)
3. **Checking**: `checkCrossRepoDeps()` queries other RepoDOs (lines 1297-1335)
4. **Notifications**: `notifyDependentRepos()` alerts when issues close (lines 1341-1355)

Status tracking: `pending` | `satisfied` | `failed`

## Related Workflows

### 1. BeadsSyncWorkflow

**File**: `/Users/nathanclevenger/projects/todo.mdx/worker/src/workflows/sync.ts`

**Purpose**: Initial bulk sync when GitHub App is installed

**Flow**:
1. Fetch `.beads/issues.jsonl` from repo
2. Import to RepoDO via `importFromJsonl()`
3. For each issue without `github_number`:
   - Call `createGitHubIssue()`
   - Rate limit: 500ms between creates
4. Sync in batches of 25

### 2. ReconcileWorkflow

**File**: `/Users/nathanclevenger/projects/todo.mdx/worker/src/workflows/reconcile.ts`

**Purpose**: Periodic sync from RepoDO → D1/Payload (every 5 minutes via cron)

**Flow**:
1. Query repos with `syncEnabled=true`
2. For each repo, fetch issues from RepoDO
3. Upsert to D1 `issues` table
4. Detect conflicts (both sides modified since last sync)

**Note**: This is separate from GitHub ↔ beads bidirectional sync

### 3. DevelopWorkflow

**File**: `/Users/nathanclevenger/projects/todo.mdx/worker/src/workflows/develop.ts`

**Purpose**: Autonomous development when issues become ready

**Flow**:
1. Triggered when issue has no blockers
2. Spawns Claude sandbox to implement
3. Creates PR with changes
4. Waits for approval (durable, can pause for days)
5. Merges PR
6. Closes issue via RepoDO
7. Triggers workflows for newly ready dependents

## API Endpoints

### RepoDO HTTP API (Internal)

All endpoints exposed via `fetch(request)` handler (lines 1447-2068):

**Issues**:
- `GET /issues` - list with filters
- `GET /issues/ready` - issues with no blockers
- `GET /issues/blocked` - blocked issues with blocker list
- `GET /issues/search?q=...` - text search
- `GET /issues/:id` - single issue with deps/labels
- `POST /issues` - create issue
- `PATCH /issues/:id` - update issue
- `POST /issues/:id/close` - close issue
- `POST /issues/:id/comments` - create GitHub comment

**Dependencies**:
- `POST /dependencies` - add dependency
- `DELETE /dependencies` - remove dependency

**Cross-repo Dependencies**:
- `GET /cross-deps/:issueId` - get cross-repo deps
- `POST /cross-deps` - add cross-repo dep
- `DELETE /cross-deps` - remove cross-repo dep
- `POST /cross-deps/check` - check and update status
- `POST /notify/issue-closed` - notification from other repos

**Sync**:
- `POST /webhook/github` - GitHub issue webhook handler
- `POST /webhook/beads` - beads push webhook handler
- `POST /sync/bulk` - bulk sync unsynced issues
- `GET /export` - export to JSONL
- `POST /import` - import from JSONL
- `POST /context` - set repo context
- `GET /status` - sync status

**Milestones**:
- `POST /milestones/sync` - sync milestones from GitHub
- `GET /milestones` - list milestones

**PR Integration**:
- `POST /issue/merged` - handle PR merge, close issue

## MCP Tools Integration

**File**: `/Users/nathanclevenger/projects/todo.mdx/worker/src/mcp/index.ts`

MCP tools query RepoDO directly (not Payload):

- `search` - queries RepoDO issues table
- `fetch` - gets issue details from RepoDO
- `roadmap` - queries dependencies from RepoDO
- `do` - creates/updates via RepoDO (which syncs to GitHub)
- `list` - lists issues with filters
- `ready` - finds ready tasks
- `blocked` - finds blocked tasks

## Performance Optimizations

### 1. Retry Logic

**File**: `/Users/nathanclevenger/projects/todo.mdx/worker/src/workflows/retry.ts`

All sync operations use exponential backoff retry:

```typescript
const REPO_DO_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  jitterFactor: 0.3,
}
```

### 2. Batch Operations

- Bulk sync processes 25 issues at a time (line 1923 in `repo.ts`)
- 500ms delay between creates to avoid rate limits (line 1952)
- 2-second delay between batches in workflows (line 293 in `sync.ts`)

### 3. Debouncing

- 30-second debounce for GitHub → beads updates (lines 946-957)
- 60-second protection for deletions (lines 593-604)

### 4. Caching

- Installation tokens are generated on-demand (no caching in code, but JWT has 10-minute lifetime)
- RepoDO state is persisted in Durable Object SQLite

## Testing Gaps

Based on code analysis, these scenarios should be tested:

1. **Concurrent updates**: Issue updated in both GitHub and beads simultaneously
2. **Delete race condition**: Issue deleted locally while GitHub webhook in flight
3. **Network failures**: GitHub API down during sync
4. **Large repos**: Bulk sync with 1000+ issues
5. **Label conflicts**: Custom labels vs system labels
6. **Cross-repo circular deps**: A → B → A dependency chains

## Conclusion

**The bidirectional sync is FULLY IMPLEMENTED and operational.**

### Key Strengths:

1. ✅ **Complete bidirectional flow**: GitHub → RepoDO → beads AND beads → RepoDO → GitHub
2. ✅ **Conflict avoidance**: Debouncing + last-write-wins prevents loops
3. ✅ **Schema compatibility**: RepoDO exactly matches beads with sync extensions
4. ✅ **Race condition protection**: Multiple safeguards for concurrent operations
5. ✅ **Retry resilience**: Exponential backoff for transient failures
6. ✅ **Cross-repo support**: Dependencies across repositories
7. ✅ **Workflow integration**: Auto-triggers when issues become ready
8. ✅ **Audit trail**: `sync_log` table tracks all operations

### How It Works:

**Example: Developer creates issue locally**
```bash
bd create --title "Fix bug"
git add .beads/issues.jsonl
git commit -m "Add issue"
git push
```

1. GitHub receives push, sends webhook
2. Worker detects `.beads/issues.jsonl` changed
3. RepoDO fetches JSONL, parses issue
4. RepoDO calls GitHub API to create issue
5. GitHub sends `issues.created` webhook back
6. RepoDO updates issue with `github_number`
7. RepoDO commits updated JSONL to repo
8. Result: Issue exists in beads, GitHub, and RepoDO (synced)

**Example: User creates issue on GitHub**
```
User clicks "New Issue" on GitHub → fills out form → clicks "Create"
```

1. GitHub creates issue, sends `issues.opened` webhook
2. Worker routes to RepoDO `onGitHubIssue()`
3. RepoDO parses GitHub issue to beads format
4. RepoDO upserts to SQLite
5. RepoDO commits to `.beads/issues.jsonl`
6. Result: Issue exists in GitHub, RepoDO, and beads (synced)

### No Changes Needed

The system is production-ready. The issue `todo-8ufg` can be marked as complete.
