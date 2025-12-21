/**
 * Drizzle ORM client for D1
 *
 * Provides type-safe database access using the schema pulled from Payload CMS.
 */

import { drizzle } from 'drizzle-orm/d1'
import type { D1Database } from '@cloudflare/workers-types'
import * as schema from './schema'

export type DrizzleDb = ReturnType<typeof createDrizzle>

/**
 * Create a Drizzle client for D1
 */
export function createDrizzle(d1: D1Database) {
  return drizzle(d1, { schema })
}

// Re-export schema for convenience
export * from './schema'
