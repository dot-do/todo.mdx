---
id: todo-sz2t
title: "Implement GitHub webhook handler with signature verification"
state: open
priority: 1
type: task
labels: ["github-app", "phase-1", "security"]
createdAt: "2025-12-23T13:37:01.905Z"
updatedAt: "2025-12-23T13:37:01.905Z"
source: "beads"
---

# Implement GitHub webhook handler with signature verification

Create Hono webhook handler for GitHub issue events with HMAC-SHA256 signature verification.

## Events to Handle
- `issues.opened` - New issue created
- `issues.edited` - Issue title/body changed
- `issues.closed` - Issue closed
- `issues.reopened` - Issue reopened
- `issues.labeled` - Label added
- `issues.unlabeled` - Label removed
- `issues.assigned` - Assignee changed
- `installation.created` - App installed
- `installation.deleted` - App uninstalled

## Implementation
```typescript
// worker/webhooks/github.ts
import { Hono } from 'hono'
import { verifyGitHubWebhook } from './verify'

const app = new Hono()

app.post('/webhook/github', async (c) => {
  const signature = c.req.header('x-hub-signature-256')
  const event = c.req.header('x-github-event')
  const body = await c.req.text()
  
  if (!verifyGitHubWebhook(body, signature, WEBHOOK_SECRET)) {
    return c.json({ error: 'Invalid signature' }, 401)
  }
  
  const payload = JSON.parse(body)
  await queueEvent(event, payload)  // Durable Object queue
  
  return c.json({ ok: true })
})
```

## Security
- HMAC-SHA256 verification using `crypto.subtle`
- Idempotent handling (check delivery ID)
- Rate limiting per installation

### Related Issues

**Depends on:**
- **todo-8wqd**
- **todo-v5yv**

**Blocks:**
- **todo-qu6s**

### Timeline

- **Created:** 12/23/2025
- **Updated:** 12/23/2025
