/**
 * Embedding Workflow
 *
 * Cloudflare Workflow that generates embeddings for issues and milestones.
 * Uses Workers AI bge-m3 model and stores vectors in Vectorize.
 *
 * Triggered by:
 * - Issue created/updated webhooks
 * - Milestone created/updated webhooks
 * - Manual bulk re-index via API
 *
 * Flow:
 * 1. Receive content payload (id, title, body, metadata)
 * 2. Generate embedding via Workers AI @cf/baai/bge-m3
 * 3. Upsert vector to Vectorize with metadata
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers'

// ============================================================================
// Workflow Payload Types
// ============================================================================

export interface EmbedPayload {
  /** Content type being embedded */
  type: 'issue' | 'milestone'

  /** Unique ID for this vector (format: {type}:{repo}:{number}) */
  id: string

  /** Repository full name (owner/repo) */
  repo: string

  /** Content title */
  title: string

  /** Content body/description */
  body: string

  /** Current status/state */
  status: string

  /** URL to the content on GitHub */
  url: string

  /** Optional labels (for issues) */
  labels?: string[]
}

export interface BulkEmbedPayload {
  /** Multiple items to embed in batch */
  items: EmbedPayload[]
}

// ============================================================================
// Workflow Environment
// ============================================================================

interface WorkflowEnv {
  AI: Ai
  VECTORIZE: VectorizeIndex
}

// ============================================================================
// Single Item Embedding Workflow
// ============================================================================

export class EmbedWorkflow extends WorkflowEntrypoint<WorkflowEnv, EmbedPayload> {
  async run(
    event: WorkflowEvent<EmbedPayload>,
    step: WorkflowStep
  ): Promise<void> {
    const payload = event.payload

    console.log(`[EmbedWorkflow] Processing ${payload.type} ${payload.id}`)

    // Step 1: Prepare text for embedding
    const text = await step.do('prepare-text', async () => {
      // Combine title and body for embedding
      // Include labels if available for better semantic matching
      const parts = [payload.title]
      if (payload.body) {
        parts.push(payload.body)
      }
      if (payload.labels?.length) {
        parts.push(`Labels: ${payload.labels.join(', ')}`)
      }
      return parts.join('\n\n')
    })

    // Step 2: Generate embedding via Workers AI
    const embedding = await step.do('generate-embedding', async () => {
      const result = await this.env.AI.run('@cf/baai/bge-m3', {
        text: [text],
      }) as { data: number[][] }
      // bge-m3 returns { data: [[...1024 floats]] } for text input
      return result.data[0]
    })

    console.log(`[EmbedWorkflow] Generated ${embedding.length}-dim embedding`)

    // Step 3: Upsert to Vectorize
    await step.do('upsert-vector', async () => {
      await this.env.VECTORIZE.upsert([
        {
          id: payload.id,
          values: embedding,
          metadata: {
            type: payload.type,
            repo: payload.repo,
            title: payload.title,
            status: payload.status,
            url: payload.url,
          },
        },
      ])
    })

    console.log(`[EmbedWorkflow] Upserted vector for ${payload.id}`)
  }
}

// ============================================================================
// Bulk Embedding Workflow (for re-indexing)
// ============================================================================

export class BulkEmbedWorkflow extends WorkflowEntrypoint<WorkflowEnv, BulkEmbedPayload> {
  async run(
    event: WorkflowEvent<BulkEmbedPayload>,
    step: WorkflowStep
  ): Promise<void> {
    const { items } = event.payload

    console.log(`[BulkEmbedWorkflow] Processing ${items.length} items`)

    // Process in batches of 100 (Workers AI batch limit)
    const batchSize = 100
    const batches = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]

      // Step 1: Prepare texts
      const texts = await step.do(`prepare-texts-${batchIndex}`, async () => {
        return batch.map((item) => {
          const parts = [item.title]
          if (item.body) parts.push(item.body)
          if (item.labels?.length) parts.push(`Labels: ${item.labels.join(', ')}`)
          return parts.join('\n\n')
        })
      })

      // Step 2: Generate embeddings in batch
      const embeddings = await step.do(`generate-embeddings-${batchIndex}`, async () => {
        const result = await this.env.AI.run('@cf/baai/bge-m3', {
          text: texts,
        }) as { data: number[][] }
        return result.data
      })

      // Step 3: Upsert all vectors (Vectorize supports up to 1000 per call)
      await step.do(`upsert-vectors-${batchIndex}`, async () => {
        const vectors = batch.map((item, index) => ({
          id: item.id,
          values: embeddings[index],
          metadata: {
            type: item.type,
            repo: item.repo,
            title: item.title,
            status: item.status,
            url: item.url,
          },
        }))

        await this.env.VECTORIZE.upsert(vectors)
      })

      console.log(
        `[BulkEmbedWorkflow] Completed batch ${batchIndex + 1}/${batches.length} (${batch.length} items)`
      )
    }

    console.log(`[BulkEmbedWorkflow] Finished processing ${items.length} items`)
  }
}
