# Linear Integration

Two-way sync between Linear and todo.mdx.

## Features

- OAuth authentication with Linear workspaces
- Real-time webhook sync for issues, cycles, and projects
- Maps Linear states to todo.mdx statuses
- Maps Linear cycles to milestones
- Syncs labels, assignees, and priorities

## Setup

### 1. Create Linear OAuth Application

1. Go to https://linear.app/settings/api
2. Create a new OAuth application
3. Set the redirect URI to: `https://todo.mdx.do/integrations/linear/callback`
4. Copy the Client ID and Client Secret

### 2. Configure Worker

Set the environment variables using `wrangler secret`:

```bash
cd worker
wrangler secret put LINEAR_CLIENT_ID
wrangler secret put LINEAR_CLIENT_SECRET
```

### 3. Create Webhook (Optional)

For real-time sync, create a webhook in Linear:

1. Go to https://linear.app/settings/api/webhooks
2. Create a new webhook
3. Set URL to: `https://worker.todo.mdx.do/linear/webhook`
4. Subscribe to: `Issue`, `Cycle`, `Project` events
5. Copy the webhook secret

```bash
wrangler secret put LINEAR_WEBHOOK_SECRET
```

## API Endpoints

### OAuth Flow

**Initiate OAuth**
```
GET /api/linear/connect?redirect_uri=<callback_url>
Authorization: Bearer <token>
```

Returns:
```json
{
  "authUrl": "https://linear.app/oauth/authorize?...",
  "state": "uuid"
}
```

**OAuth Callback**
```
GET /api/linear/callback?code=<code>&state=<state>
```

Returns:
```json
{
  "success": true,
  "integration": {
    "id": "integration_id",
    "organization": {
      "id": "org_id",
      "name": "Org Name",
      "urlKey": "org-key"
    }
  }
}
```

### Workspace Management

**Get Workspaces**
```
GET /api/linear/workspaces
Authorization: Bearer <token>
```

Returns:
```json
{
  "organization": {
    "id": "org_id",
    "name": "Org Name",
    "urlKey": "org-key"
  },
  "teams": [
    {
      "id": "team_id",
      "name": "Team Name",
      "key": "TEAM"
    }
  ]
}
```

**Get Teams**
```
GET /api/linear/teams
Authorization: Bearer <token>
```

Returns:
```json
{
  "teams": [...]
}
```

### Sync

**Trigger Manual Sync**
```
POST /api/linear/sync
Authorization: Bearer <token>
Content-Type: application/json

{
  "repoId": "payload_repo_id",
  "teamId": "linear_team_id" // optional
}
```

Returns:
```json
{
  "success": true,
  "result": {
    "issuesCreated": 10,
    "issuesUpdated": 5,
    "cyclesCreated": 2,
    "projectsCreated": 1,
    "errors": []
  }
}
```

**Get Sync Status**
```
GET /api/linear/sync/:repoId
Authorization: Bearer <token>
```

Returns:
```json
{
  "connected": true,
  "integration": {
    "id": "integration_id",
    "organization": "Org Name",
    "lastSync": "2024-01-01T00:00:00Z",
    "active": true
  }
}
```

### Integration Management

**List Integrations**
```
GET /api/linear/integrations
Authorization: Bearer <token>
```

Returns:
```json
{
  "integrations": [
    {
      "id": "integration_id",
      "linearData": {
        "organizationId": "org_id",
        "organizationName": "Org Name",
        "teamId": "team_id",
        "teamName": "Team Name"
      },
      "repo": "repo_id",
      "active": true,
      "lastSyncAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**Disconnect Integration**
```
DELETE /api/linear/integrations/:id
Authorization: Bearer <token>
```

Returns:
```json
{
  "success": true
}
```

### Webhooks

**Linear Webhook Handler**
```
POST /linear/webhook
Linear-Signature: <signature>
Content-Type: application/json

{
  "action": "create" | "update" | "remove",
  "type": "Issue" | "Cycle" | "Project",
  "data": {...},
  "organizationId": "org_id",
  "webhookId": "webhook_id",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

Returns:
```json
{
  "status": "created" | "updated" | "deleted" | "acknowledged"
}
```

## State Mapping

### Linear State → todo.mdx Status

| Linear State | todo.mdx Status |
|--------------|-----------------|
| backlog      | open            |
| unstarted    | open            |
| started      | in_progress     |
| completed    | closed          |
| canceled     | closed          |

### Priority Mapping

Linear and todo.mdx use the same priority scale:

| Priority | Description |
|----------|-------------|
| 0        | Critical/Urgent |
| 1        | High |
| 2        | Medium (default) |
| 3        | Low |
| 4        | None/Backlog |

### Cycle → Milestone

Linear cycles are synced as milestones in todo.mdx:

- `cycle.name` → `milestone.title`
- `cycle.number` → stored in `milestone.linearData.number`
- `cycle.startsAt` → `milestone.linearData.startsAt`
- `cycle.endsAt` → `milestone.dueOn`

## Data Model

### Linear Integration (Payload Collection)

```typescript
{
  user: string // Payload user ID
  repo?: string // Optional repo to sync to
  linearData: {
    organizationId: string
    organizationName: string
    urlKey: string
    userId: string
    userEmail: string
    teamId?: string // Optional team filter
    teamName?: string
  }
  webhookId?: string
  webhookSecret?: string
  active: boolean
  lastSyncAt?: Date
  lastSyncResult?: {
    issuesCreated: number
    issuesUpdated: number
    cyclesCreated: number
    projectsCreated: number
    errors: string[]
  }
  syncSettings: {
    autoSync: boolean
    syncCycles: boolean
    syncProjects: boolean
    syncLabels: boolean
  }
}
```

### Issue Linear Data

Stored in `issue.linearData`:

```typescript
{
  id: string // Linear issue ID
  identifier: string // e.g., "TODO-123"
  stateId: string
  stateName: string
  cycleId?: string
  projectId?: string
}
```

### Milestone Linear Data

Stored in `milestone.linearData`:

```typescript
{
  id: string // Linear cycle ID
  number: number
  startsAt: Date
}
```

## GraphQL Client

The integration includes a full-featured Linear GraphQL client:

```typescript
import { LinearClient } from '../integrations/linear'

const client = new LinearClient(accessToken)

// Get viewer
const viewer = await client.getViewer()

// Get teams
const teams = await client.getTeams()

// Get issues (paginated)
const { nodes, pageInfo } = await client.getIssues(teamId, 50)

// Get cycles
const cycles = await client.getCycles(teamId)

// Create issue
await client.createIssue({
  teamId: 'team_id',
  title: 'New issue',
  description: 'Description',
  priority: 1,
  stateId: 'state_id'
})

// Update issue
await client.updateIssue(issueId, {
  title: 'Updated title',
  stateId: 'new_state_id'
})
```

## Sync Logic

### Full Sync

Triggered via `POST /api/linear/sync`:

1. Fetch all Linear issues (paginated)
2. For each issue:
   - Check if exists in Payload (by `linearData.id`)
   - Create or update issue
3. If teamId provided, sync cycles to milestones
4. Track projects in issue metadata

### Webhook Sync

Real-time updates via Linear webhooks:

1. Receive webhook event
2. Find integration by `organizationId`
3. Handle based on event type:
   - **Issue**: Create/update/delete issue
   - **Cycle**: Create/update/delete milestone
   - **Project**: Track in metadata

## Security

- OAuth tokens stored encrypted in WorkOS Vault
- Webhook signatures verified (when LINEAR_WEBHOOK_SECRET set)
- User access controlled via Payload relationships
- Secrets never exposed in API responses

## Error Handling

Sync errors are collected and returned in the result:

```json
{
  "issuesCreated": 10,
  "issuesUpdated": 5,
  "errors": [
    "Failed to sync issue TODO-123: State not found",
    "Failed to sync cycles: Permission denied"
  ]
}
```

Webhook errors are logged but don't fail the request.

## Future Enhancements

- [ ] Bi-directional sync (todo.mdx → Linear)
- [ ] Comment sync
- [ ] Attachment sync
- [ ] Custom field mapping
- [ ] Team-specific configurations
- [ ] Conflict resolution strategies
- [ ] Sync scheduling (cron)
