/**
 * Cloudflare Worker RPC entry point for Payload CMS
 *
 * This worker exports the Payload instance via Workers RPC,
 * allowing other workers to access Payload via service bindings.
 *
 * Usage in main worker:
 *   const payload = await env.PAYLOAD.getPayload()
 *   const issues = await payload.find({ collection: 'issues' })
 */

import { WorkerEntrypoint } from 'cloudflare:workers'
import { Payload, getPayload } from 'payload'
import config from './payload.config'

export interface Env {
  D1: D1Database
  R2: R2Bucket
  PAYLOAD_SECRET: string
}

/**
 * RPC service class that exports Payload methods
 */
export class PayloadRPC extends WorkerEntrypoint<Env> {
  private payloadPromise: Promise<Payload> | null = null

  /**
   * Get or initialize the Payload instance
   */
  async getPayload(): Promise<Payload> {
    if (!this.payloadPromise) {
      this.payloadPromise = getPayload({
        config,
      })
    }
    return this.payloadPromise
  }

  /**
   * Direct access to find operations
   */
  async find(params: {
    collection: string
    where?: any
    limit?: number
    page?: number
    sort?: string
    depth?: number
  }) {
    const payload = await this.getPayload()
    return payload.find(params)
  }

  /**
   * Direct access to findByID operations
   */
  async findByID(params: {
    collection: string
    id: string | number
    depth?: number
  }) {
    const payload = await this.getPayload()
    return payload.findByID(params)
  }

  /**
   * Direct access to create operations
   */
  async create(params: {
    collection: string
    data: any
    depth?: number
  }) {
    const payload = await this.getPayload()
    return payload.create(params)
  }

  /**
   * Direct access to update operations
   */
  async update(params: {
    collection: string
    id: string | number
    data: any
    depth?: number
  }) {
    const payload = await this.getPayload()
    return payload.update(params)
  }

  /**
   * Direct access to delete operations
   */
  async delete(params: {
    collection: string
    id: string | number
  }) {
    const payload = await this.getPayload()
    return payload.delete(params)
  }
}

/**
 * Worker fetch handler
 * This allows the worker to also respond to HTTP requests if needed
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return new Response('Payload RPC Worker - use service bindings to access Payload', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    })
  },
}
