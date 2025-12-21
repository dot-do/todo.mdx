---
id: todo-kdl
title: "Create Cloudflare Workflow for embedding generation"
state: closed
priority: 1
type: feature
labels: [vectorize, workers-ai, workflows]
---

# Create Cloudflare Workflow for embedding generation

Implement a Cloudflare Workflow to handle async embedding generation when issues/milestones are created or updated.

## Why Workflows?
- Embedding generation can be slow (API calls to Workers AI)
- Workflows handle retries, failures, and rate limits gracefully
- Decouples webhook processing from embedding generation
- Can batch multiple embeddings efficiently

## Workflow Design

### Triggers
1. Issue created/updated (via GitHub webhook)
2. Milestone created/updated
3. Bulk re-index (manual trigger)

### Workflow Steps
```typescript
// worker/src/workflows/embed.ts
import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers'

export class EmbedWorkflow extends WorkflowEntrypoint<Env> {
  async run(event: WorkflowEvent<EmbedPayload>, step: WorkflowStep) {
    // Step 1: Fetch full content
    const content = await step.do('fetch-content', async () => {
      // Get issue/milestone full text from DO or Payload
    })

    // Step 2: Generate embedding
    const embedding = await step.do('generate-embedding', async () => {
      return this.env.AI.run('@cf/baai/bge-m3', {
        text: [content.title, content.body].join('\n')
      })
    })

    // Step 3: Upsert to Vectorize
    await step.do('upsert-vector', async () => {
      return this.env.VECTORIZE.upsert([{
        id: content.id,
        values: embedding.data[0],
        metadata: {
          type: content.type,
          repo: content.repo,
          title: content.title,
          status: content.status,
          url: content.url
        }
      }])
    })
  }
}
```

### Wrangler Config
```jsonc
{
  "workflows": [
    {
      "name": "embed-workflow",
      "binding": "EMBED_WORKFLOW",
      "class_name": "EmbedWorkflow"
    }
  ]
}
```

## Batching Strategy
For bulk re-index, batch embeddings:
- Workers AI supports batch inference
- Vectorize upsert supports up to 1000 vectors per call
- Use workflow steps to checkpoint progress

### Related Issues

**Blocks:**
- **todo-peb**: Trigger embedding workflow from GitHub webhooks

### Timeline

- **Created:** 12/20/2025

