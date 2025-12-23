---
id: todo-t8ts
title: "Models Payload collection + OpenRouter sync job"
state: closed
priority: 1
type: task
labels: ["models", "payload"]
createdAt: "2025-12-21T18:47:39.774Z"
updatedAt: "2025-12-21T19:08:48.938Z"
closedAt: "2025-12-21T19:08:48.938Z"
source: "beads"
---

# Models Payload collection + OpenRouter sync job

Create Models collection synced from OpenRouter:

`apps/admin/src/collections/Models.ts`

Fields from API:
- modelId: text (unique)
- name, provider, contextLength, pricing, capabilities
- lastSyncedAt: date

Manual curation:
- status: select [available, recommended, deprecated, hidden]
- tier: select [fast, balanced, reasoning, specialized]
- bestFor: json
- notes: textarea

`worker/src/jobs/sync-models.ts`

Hourly job fetches https://openrouter.ai/api/v1/models and upserts to Payload.

### Related Issues

**Depends on:**
- **todo-ygfz**

**Blocks:**
- **todo-vqau**

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
