/**
 * Payload CMS client for the worker
 *
 * Uses the same D1 database as the admin app, with overrideAccess
 * for server-to-server operations (webhooks, internal API calls).
 */

import { getPayload, Payload } from 'payload'
import { createWorkerConfig } from '@todo.mdx/admin'
import type { Env } from './types'

// Cache the payload instance per request context
let payloadInstance: Payload | null = null
let configuredEnv: Env | null = null

/**
 * Get a Payload instance configured for this worker
 *
 * Uses a cached instance if the env hasn't changed.
 * Always uses overrideAccess: true for server-side operations.
 */
export async function getPayloadClient(env: Env): Promise<Payload> {
  // Return cached instance if env matches
  if (payloadInstance && configuredEnv === env) {
    return payloadInstance
  }

  // Create a new config with the worker's D1 binding
  const config = await createWorkerConfig({
    D1: env.DB,
    PAYLOAD_SECRET: env.PAYLOAD_SECRET,
  })

  // Initialize Payload
  payloadInstance = await getPayload({ config })
  configuredEnv = env

  return payloadInstance
}

/**
 * Payload operations wrapper with overrideAccess: true
 *
 * Provides a simple interface for common Payload operations
 * that bypasses access control for server-side code.
 */
export function createPayloadOps(payload: Payload) {
  return {
    async find<T = any>(args: {
      collection: string
      where?: Record<string, unknown>
      limit?: number
      depth?: number
      sort?: string
    }): Promise<{ docs: T[]; totalDocs: number }> {
      return payload.find({
        collection: args.collection as any,
        where: args.where as any,
        limit: args.limit,
        depth: args.depth,
        sort: args.sort,
        overrideAccess: true,
      }) as any
    },

    async findByID<T = any>(args: {
      collection: string
      id: string | number
      depth?: number
    }): Promise<T> {
      return payload.findByID({
        collection: args.collection as any,
        id: args.id,
        depth: args.depth,
        overrideAccess: true,
      }) as any
    },

    async create<T = any>(args: {
      collection: string
      data: Record<string, unknown>
    }): Promise<T> {
      return payload.create({
        collection: args.collection as any,
        data: args.data as any,
        overrideAccess: true,
      }) as any
    },

    async update<T = any>(args: {
      collection: string
      id: string | number
      data: Record<string, unknown>
    }): Promise<T> {
      return payload.update({
        collection: args.collection as any,
        id: args.id,
        data: args.data as any,
        overrideAccess: true,
      }) as any
    },

    async delete(args: {
      collection: string
      id: string | number
    }): Promise<void> {
      await payload.delete({
        collection: args.collection as any,
        id: args.id,
        overrideAccess: true,
      })
    },
  }
}

export type PayloadOps = ReturnType<typeof createPayloadOps>
