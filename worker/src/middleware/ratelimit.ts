/**
 * Rate limiting middleware for Cloudflare Workers using RateLimitDO
 *
 * Provides flexible rate limiting for different endpoint types with
 * proper 429 responses and Retry-After headers.
 */

import type { Context, MiddlewareHandler } from 'hono'
import type { Env } from '../types'
import type { RateLimitConfig, RateLimitResult } from '../do/ratelimit'

/**
 * Rate limit configuration for different endpoint types
 */
export const RATE_LIMITS = {
  // Auth endpoints - strict limits to prevent brute force
  auth: {
    limit: 5,
    windowSeconds: 60, // 5 requests per minute
  },

  // GraphQL endpoints - moderate limits to prevent expensive queries
  graphql: {
    limit: 30,
    windowSeconds: 60, // 30 requests per minute
  },

  // General API endpoints
  api: {
    limit: 100,
    windowSeconds: 60, // 100 requests per minute
  },

  // Webhook endpoints - higher limits for automated systems
  webhook: {
    limit: 1000,
    windowSeconds: 60, // 1000 requests per minute
  },

  // MCP endpoints - moderate limits
  mcp: {
    limit: 60,
    windowSeconds: 60, // 60 requests per minute
  },

  // Voice/AI endpoints - strict limits due to cost
  voice: {
    limit: 10,
    windowSeconds: 60, // 10 requests per minute
  },

  // Browser session endpoints - strict limits to prevent session abuse
  browser: {
    limit: 10,
    windowSeconds: 60, // 10 sessions per minute
  },
} as const

export type RateLimitScope = keyof typeof RATE_LIMITS

/**
 * Get rate limit identifier from request
 * Uses IP address as primary identifier, with user ID as fallback
 */
function getRateLimitKey(c: Context<{ Bindings: Env }>): string {
  // Try to get user ID from auth context
  const auth = c.get('auth') as any
  if (auth?.userId) {
    return `user:${auth.userId}`
  }

  // Fall back to IP address
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
  return `ip:${ip}`
}

/**
 * Apply rate limit headers to response
 */
function applyRateLimitHeaders(response: Response, result: RateLimitResult): Response {
  const headers = new Headers(response.headers)

  headers.set('X-RateLimit-Limit', result.limit.toString())
  headers.set('X-RateLimit-Remaining', result.remaining.toString())
  headers.set('X-RateLimit-Reset', Math.floor(result.resetAt / 1000).toString())

  if (!result.allowed && result.retryAfter) {
    headers.set('Retry-After', result.retryAfter.toString())
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * Rate limiting middleware
 *
 * Usage:
 * ```ts
 * app.use('/api/auth/*', rateLimitMiddleware('auth'))
 * app.use('/api/graphql', rateLimitMiddleware('graphql'))
 * app.use('/api/*', rateLimitMiddleware('api'))
 * ```
 */
export function rateLimitMiddleware(scope: RateLimitScope): MiddlewareHandler {
  return async (c, next) => {
    const env = c.env as Env

    // Get rate limit configuration for this scope
    const config = RATE_LIMITS[scope]

    // Get rate limit key (IP or user ID)
    const key = getRateLimitKey(c)

    // Get RateLimitDO instance (one per shard for load distribution)
    // Use consistent hashing based on key to ensure same DO handles same key
    const shardId = hashString(key) % 10 // 10 shards for load distribution
    const doId = env.RATELIMIT.idFromName(`ratelimit:${shardId}`)
    const stub = env.RATELIMIT.get(doId)

    // Check rate limit
    const rateLimitConfig: RateLimitConfig = {
      limit: config.limit,
      windowSeconds: config.windowSeconds,
      key,
      scope,
    }

    try {
      const response = await stub.fetch('http://do/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rateLimitConfig),
      })

      const result = await response.json() as RateLimitResult

      // If rate limit exceeded, return 429
      if (!result.allowed) {
        const response = new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: `Too many requests. Please try again in ${result.retryAfter} seconds.`,
            limit: result.limit,
            current: result.current,
            resetAt: result.resetAt,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'X-RateLimit-Limit': result.limit.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': Math.floor(result.resetAt / 1000).toString(),
              'Retry-After': result.retryAfter?.toString() || '60',
            },
          }
        )
        return response
      }

      // Allow request and add rate limit headers to response
      await next()

      // Apply rate limit headers to the response
      return applyRateLimitHeaders(c.res, result)
    } catch (error) {
      console.error('[RateLimit] Error checking rate limit:', error)
      // On error, allow the request but log the failure
      // This prevents rate limiting from blocking all requests if DO fails
      await next()
    }
  }
}

/**
 * Simple string hash function for consistent shard selection
 */
export function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

/**
 * Create a rate limiter with custom configuration
 *
 * Usage:
 * ```ts
 * app.use('/api/custom', customRateLimit({ limit: 50, windowSeconds: 60 }, 'custom'))
 * ```
 */
export function customRateLimit(
  config: { limit: number; windowSeconds: number },
  scope: string
): MiddlewareHandler {
  return async (c, next) => {
    const env = c.env as Env
    const key = getRateLimitKey(c)

    const shardId = hashString(key) % 10
    const doId = env.RATELIMIT.idFromName(`ratelimit:${shardId}`)
    const stub = env.RATELIMIT.get(doId)

    const rateLimitConfig: RateLimitConfig = {
      limit: config.limit,
      windowSeconds: config.windowSeconds,
      key,
      scope,
    }

    try {
      const response = await stub.fetch('http://do/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rateLimitConfig),
      })

      const result = await response.json() as RateLimitResult

      if (!result.allowed) {
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: `Too many requests. Please try again in ${result.retryAfter} seconds.`,
            limit: result.limit,
            current: result.current,
            resetAt: result.resetAt,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'X-RateLimit-Limit': result.limit.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': Math.floor(result.resetAt / 1000).toString(),
              'Retry-After': result.retryAfter?.toString() || '60',
            },
          }
        )
      }

      await next()
      return applyRateLimitHeaders(c.res, result)
    } catch (error) {
      console.error('[RateLimit] Error checking rate limit:', error)
      await next()
    }
  }
}
