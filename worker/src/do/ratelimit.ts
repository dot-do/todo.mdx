/**
 * RateLimitDO - Durable Object for distributed rate limiting
 *
 * Uses sliding window algorithm with SQLite for efficient rate limiting.
 * Supports per-IP, per-user, and per-endpoint limits.
 */

import { DurableObject } from 'cloudflare:workers'
import type { Env } from '../types'

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the window
   */
  limit: number

  /**
   * Time window in seconds
   */
  windowSeconds: number

  /**
   * Identifier for the rate limit (e.g., IP address, user ID)
   */
  key: string

  /**
   * Endpoint or scope being rate limited
   */
  scope: string
}

export interface RateLimitResult {
  /**
   * Whether the request is allowed
   */
  allowed: boolean

  /**
   * Current request count in the window
   */
  current: number

  /**
   * Maximum requests allowed
   */
  limit: number

  /**
   * Remaining requests in the window
   */
  remaining: number

  /**
   * Unix timestamp when the limit resets
   */
  resetAt: number

  /**
   * Seconds until reset
   */
  retryAfter?: number
}

export class RateLimitDO extends DurableObject<Env> {
  private sql!: SqlStorage
  private initialized = false

  private async ensureInitialized() {
    if (this.initialized) return

    this.sql = this.ctx.storage.sql

    // Create table for tracking requests
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL,
        scope TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_requests_key_scope ON requests(key, scope);
      CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests(timestamp);
    `)

    this.initialized = true
  }

  /**
   * Check if a request is allowed and record it if so
   */
  async checkLimit(config: RateLimitConfig): Promise<RateLimitResult> {
    await this.ensureInitialized()

    const now = Date.now()
    const windowStart = now - config.windowSeconds * 1000

    // Clean up old requests outside the window
    this.sql.exec(
      `DELETE FROM requests WHERE timestamp < ?`,
      windowStart
    )

    // Count current requests in the window for this key and scope
    const countResult = this.sql.exec(
      `SELECT COUNT(*) as count FROM requests
       WHERE key = ? AND scope = ? AND timestamp >= ?`,
      config.key,
      config.scope,
      windowStart
    ).toArray()

    const current = (countResult[0] as any).count as number

    // Calculate result
    const allowed = current < config.limit
    const remaining = Math.max(0, config.limit - current - (allowed ? 1 : 0))
    const resetAt = now + config.windowSeconds * 1000
    const retryAfter = allowed ? undefined : Math.ceil(config.windowSeconds)

    // If allowed, record the request
    if (allowed) {
      this.sql.exec(
        `INSERT INTO requests (key, scope, timestamp) VALUES (?, ?, ?)`,
        config.key,
        config.scope,
        now
      )
    }

    return {
      allowed,
      current: current + (allowed ? 1 : 0),
      limit: config.limit,
      remaining,
      resetAt,
      retryAfter,
    }
  }

  /**
   * Get current usage for a key and scope
   */
  async getUsage(key: string, scope: string, windowSeconds: number): Promise<number> {
    await this.ensureInitialized()

    const now = Date.now()
    const windowStart = now - windowSeconds * 1000

    const result = this.sql.exec(
      `SELECT COUNT(*) as count FROM requests
       WHERE key = ? AND scope = ? AND timestamp >= ?`,
      key,
      scope,
      windowStart
    ).toArray()

    return (result[0] as any).count as number
  }

  /**
   * Reset all limits for a key
   */
  async reset(key: string): Promise<number> {
    await this.ensureInitialized()

    const result = this.sql.exec(
      `DELETE FROM requests WHERE key = ?`,
      key
    )

    return result.rowsWritten
  }

  /**
   * Clean up old requests (scheduled cleanup)
   */
  async cleanup(maxAgeSeconds = 3600): Promise<number> {
    await this.ensureInitialized()

    const now = Date.now()
    const cutoff = now - maxAgeSeconds * 1000

    const result = this.sql.exec(
      `DELETE FROM requests WHERE timestamp < ?`,
      cutoff
    )

    return result.rowsWritten
  }

  /**
   * HTTP interface
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    try {
      // POST /check - Check rate limit
      if (path === '/check' && request.method === 'POST') {
        const config = await request.json() as RateLimitConfig
        const result = await this.checkLimit(config)
        return Response.json(result)
      }

      // POST /usage - Get current usage
      if (path === '/usage' && request.method === 'POST') {
        const { key, scope, windowSeconds } = await request.json() as {
          key: string
          scope: string
          windowSeconds: number
        }
        const count = await this.getUsage(key, scope, windowSeconds)
        return Response.json({ count })
      }

      // POST /reset - Reset limits for a key
      if (path === '/reset' && request.method === 'POST') {
        const { key } = await request.json() as { key: string }
        const deleted = await this.reset(key)
        return Response.json({ deleted })
      }

      // POST /cleanup - Clean up old requests
      if (path === '/cleanup' && request.method === 'POST') {
        const { maxAgeSeconds } = await request.json() as { maxAgeSeconds?: number }
        const deleted = await this.cleanup(maxAgeSeconds)
        return Response.json({ deleted })
      }

      return Response.json({ error: 'Not found' }, { status: 404 })
    } catch (error: any) {
      console.error('[RateLimitDO] Error:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }
  }

  /**
   * Scheduled cleanup alarm
   */
  async alarm() {
    await this.cleanup()
  }
}
