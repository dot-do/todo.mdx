/**
 * Worker-compatible Payload configuration
 *
 * This module exports a function to create a Payload config for use in
 * Cloudflare Workers that share the same D1 database as the admin app.
 */

import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite'
import { buildConfig, Config } from 'payload'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Installations } from './collections/Installations'
import { Repos } from './collections/Repos'
import { Issues } from './collections/Issues'
import { Milestones } from './collections/Milestones'
import { SyncEvents } from './collections/SyncEvents'
import { LinearIntegrations } from './collections/LinearIntegrations'
import { Agents } from './collections/Agents'

export interface WorkerBindings {
  D1: D1Database
  PAYLOAD_SECRET?: string
}

/**
 * Create a Payload config for use in a Cloudflare Worker
 *
 * @param bindings - Worker environment bindings (must include D1)
 * @param options - Optional config overrides
 */
export function createWorkerConfig(bindings: WorkerBindings, options?: Partial<Config>) {
  const secret = bindings.PAYLOAD_SECRET || process.env.PAYLOAD_SECRET
  if (!secret) {
    throw new Error('PAYLOAD_SECRET is required')
  }

  return buildConfig({
    // Disable admin UI for worker usage
    admin: {
      user: Users.slug,
      disable: true,
    },
    collections: [Users, Media, Installations, Repos, Issues, Milestones, SyncEvents, LinearIntegrations, Agents],
    // No editor needed for API-only usage
    secret,
    db: sqliteD1Adapter({ binding: bindings.D1 }),
    // Allow overrides
    ...options,
  })
}

// Re-export collections for convenience
export * from './collections'

// Re-export types
export type { Config } from 'payload'
