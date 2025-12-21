/**
 * PayloadRPC - Workers RPC entrypoint for Payload CMS
 *
 * Exposes Payload's local API via Cloudflare Workers RPC.
 * This allows other workers to call Payload methods directly
 * without going through HTTP.
 */

import { WorkerEntrypoint } from 'cloudflare:workers'
import { getPayload, type Payload } from 'payload'
import config from './payload.config'
import type {
  Installation,
  Repo,
  Issue,
  Milestone,
  User,
  SyncEvent,
  LinearIntegration,
  Agent,
} from './payload-types'

// Type for collection slugs
type CollectionSlug =
  | 'users'
  | 'media'
  | 'installations'
  | 'repos'
  | 'issues'
  | 'milestones'
  | 'sync-events'
  | 'linear-integrations'
  | 'agents'

// Generic find args
interface FindArgs {
  collection: CollectionSlug
  where?: Record<string, unknown>
  limit?: number
  depth?: number
  sort?: string
  overrideAccess?: boolean
}

interface FindByIDArgs {
  collection: CollectionSlug
  id: string | number
  depth?: number
  overrideAccess?: boolean
}

interface CreateArgs {
  collection: CollectionSlug
  data: Record<string, unknown>
  overrideAccess?: boolean
}

interface UpdateArgs {
  collection: CollectionSlug
  id: string | number
  data: Record<string, unknown>
  overrideAccess?: boolean
}

interface DeleteArgs {
  collection: CollectionSlug
  id: string | number
  overrideAccess?: boolean
}

export class PayloadRPC extends WorkerEntrypoint {
  private payload: Payload | null = null

  private async getPayload(): Promise<Payload> {
    if (!this.payload) {
      this.payload = await getPayload({ config })
    }
    return this.payload
  }

  /**
   * Find documents in a collection
   */
  async find(args: FindArgs): Promise<{ docs: any[]; totalDocs: number }> {
    const payload = await this.getPayload()
    const result = await payload.find({
      collection: args.collection,
      where: args.where,
      limit: args.limit,
      depth: args.depth,
      sort: args.sort,
      overrideAccess: args.overrideAccess,
    })
    return {
      docs: result.docs,
      totalDocs: result.totalDocs,
    }
  }

  /**
   * Find a single document by ID
   */
  async findByID(args: FindByIDArgs): Promise<any> {
    const payload = await this.getPayload()
    return payload.findByID({
      collection: args.collection,
      id: args.id,
      depth: args.depth,
      overrideAccess: args.overrideAccess,
    })
  }

  /**
   * Create a new document
   */
  async create(args: CreateArgs): Promise<any> {
    const payload = await this.getPayload()
    return payload.create({
      collection: args.collection,
      data: args.data,
      overrideAccess: args.overrideAccess,
    })
  }

  /**
   * Update an existing document
   */
  async update(args: UpdateArgs): Promise<any> {
    const payload = await this.getPayload()
    return payload.update({
      collection: args.collection,
      id: args.id,
      data: args.data,
      overrideAccess: args.overrideAccess,
    })
  }

  /**
   * Delete a document
   */
  async delete(args: DeleteArgs): Promise<any> {
    const payload = await this.getPayload()
    return payload.delete({
      collection: args.collection,
      id: args.id,
      overrideAccess: args.overrideAccess,
    })
  }
}
