---
id: todo-peb
title: "Trigger embedding workflow from GitHub webhooks"
state: closed
priority: 2
type: task
labels: [vectorize, webhooks, workflows]
---

# Trigger embedding workflow from GitHub webhooks

Wire up GitHub webhook handlers to dispatch embedding workflow when issues/milestones change.

## Webhook Events to Handle
- `issues.opened` - New issue created
- `issues.edited` - Issue title/body changed  
- `issues.closed` / `issues.reopened` - Status change (update metadata)
- `milestone.created` / `milestone.edited`

## Implementation

### Update webhook handler
```typescript
// worker/src/index.ts or worker/src/webhooks/github.ts

async function handleIssueEvent(event: IssueEvent, env: Env) {
  const { action, issue, repository } = event

  if (['opened', 'edited', 'closed', 'reopened'].includes(action)) {
    // Dispatch embedding workflow
    await env.EMBED_WORKFLOW.create({
      params: {
        type: 'issue',
        id: `issue:${repository.full_name}:${issue.number}`,
        repo: repository.full_name,
        title: issue.title,
        body: issue.body || '',
        status: issue.state,
        url: issue.html_url
      }
    })
  }

  // ... existing sync logic
}
```

### Delete vectors on issue delete
```typescript
if (action === 'deleted') {
  await env.VECTORIZE.deleteByIds([
    `issue:${repository.full_name}:${issue.number}`
  ])
}
```

## Idempotency
Workflow handles retries automatically. Vector upsert is idempotent (same ID overwrites).

### Timeline

- **Created:** 12/20/2025

