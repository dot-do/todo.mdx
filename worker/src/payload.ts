/**
 * Payload CMS client stub for the worker
 *
 * The Payload local API has compatibility issues with Cloudflare Workers bundling.
 * This stub provides the interface but throws if actually used.
 * Use createDirectDb() from './db/direct' for webhook handlers instead.
 */

import type { Env } from './types'

// Minimal Payload-like interface for type compatibility
interface PayloadLike {
  find: (args: any) => Promise<any>
  findByID: (args: any) => Promise<any>
  create: (args: any) => Promise<any>
  update: (args: any) => Promise<any>
  delete: (args: any) => Promise<any>
}

/**
 * Get a Payload instance - STUB
 *
 * @deprecated Use createDirectDb() from './db/direct' instead.
 * Payload local API is not compatible with Cloudflare Workers bundling.
 */
export async function getPayloadClient(env: Env): Promise<PayloadLike> {
  throw new Error(
    'getPayloadClient is not available in Workers. ' +
    'Use createDirectDb() from "./db/direct" for database operations.'
  )
}

/**
 * Payload operations wrapper - STUB
 * @deprecated Use createDirectDb() from './db/direct' instead.
 */
export function createPayloadOps(payload: PayloadLike) {
  throw new Error(
    'createPayloadOps is not available in Workers. ' +
    'Use createDirectDb() from "./db/direct" for database operations.'
  )
}

export type PayloadOps = any
