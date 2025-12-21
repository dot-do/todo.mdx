# Rate Limiting

This document describes the rate limiting implementation in the todo.mdx worker.

## Overview

The worker implements distributed rate limiting using Cloudflare Durable Objects with a sliding window algorithm. This protects the API from brute force attacks, DoS attempts, and excessive usage.

## Architecture

### Components

1. **RateLimitDO** (`worker/src/do/ratelimit.ts`)
   - Durable Object that stores request counts per key/scope
   - Uses SQLite for efficient queries
   - Implements sliding window algorithm
   - Sharded across 10 instances for load distribution

2. **Rate Limiting Middleware** (`worker/src/middleware/ratelimit.ts`)
   - Hono middleware that intercepts requests
   - Applies rate limits before route handlers
   - Returns proper 429 responses with Retry-After headers
   - Adds rate limit headers to all responses

### How It Works

```
Request → Middleware → Hash key → Select shard → RateLimitDO → Check limit → Allow/Block
```

1. Middleware extracts identifier (user ID or IP address)
2. Hashes identifier to select shard (0-9) for load distribution
3. Calls RateLimitDO to check if request is within limit
4. If allowed, request proceeds and count is incremented
5. If blocked, returns 429 with Retry-After header

## Rate Limit Configuration

Default limits are defined in `RATE_LIMITS`:

| Endpoint Type | Limit | Window | Reason |
|--------------|-------|--------|--------|
| `auth` | 5/min | 60s | Prevent brute force |
| `voice` | 10/min | 60s | AI cost control |
| `mcp` | 60/min | 60s | Moderate usage |
| `api` | 100/min | 60s | General API |
| `graphql` | 30/min | 60s | Expensive queries |
| `webhook` | 1000/min | 60s | Automated systems |

## Usage

### Applying Rate Limits

```typescript
import { rateLimitMiddleware } from './middleware/ratelimit'

// Apply to specific routes
app.use('/api/auth/*', rateLimitMiddleware('auth'))
app.use('/api/voice/*', rateLimitMiddleware('voice'))
app.use('/api/*', rateLimitMiddleware('api'))
```

### Custom Rate Limits

```typescript
import { customRateLimit } from './middleware/ratelimit'

// Custom limit: 50 requests per minute
app.use('/api/custom', customRateLimit({ limit: 50, windowSeconds: 60 }, 'custom'))
```

## Response Headers

All responses include rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1703001234
```

When rate limit is exceeded:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 45
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1703001234

{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again in 45 seconds.",
  "limit": 100,
  "current": 100,
  "resetAt": 1703001234000
}
```

## Rate Limit Keys

The system identifies requests by:

1. **User ID** (if authenticated): `user:<userId>`
2. **IP Address** (if unauthenticated): `ip:<ipAddress>`

Different scopes (auth, api, voice) are tracked separately for the same key.

## Sharding

RateLimitDO uses 10 shards for load distribution:

```typescript
const shardId = hashString(key) % 10
const doId = env.RATELIMIT.idFromName(`ratelimit:${shardId}`)
```

This ensures:
- Same key always goes to same shard (consistency)
- Load is distributed across 10 DO instances
- No single point of contention

## Cleanup

Old requests are automatically cleaned up:

1. On each check, requests outside the current window are deleted
2. Optional scheduled cleanup via `alarm()` handler
3. Manual cleanup via `/cleanup` endpoint

## Testing

Basic configuration tests are in `worker/src/test/ratelimit.test.ts`.

For integration testing:

```bash
# Send multiple requests to trigger rate limit
for i in {1..101}; do
  curl -H "CF-Connecting-IP: 1.2.3.4" https://todo.mdx.do/api/test
done

# Should return 429 on request 101
```

## Administration

### Reset a User's Limits

```typescript
const doId = env.RATELIMIT.idFromName(`ratelimit:0`) // Select appropriate shard
const stub = env.RATELIMIT.get(doId)

await stub.fetch('http://do/reset', {
  method: 'POST',
  body: JSON.stringify({ key: 'user:123' })
})
```

### Check Current Usage

```typescript
const response = await stub.fetch('http://do/usage', {
  method: 'POST',
  body: JSON.stringify({
    key: 'user:123',
    scope: 'api',
    windowSeconds: 60
  })
})

const { count } = await response.json()
console.log(`User has made ${count} requests in the last minute`)
```

## Deployment

1. Update `wrangler.jsonc` to include RateLimitDO binding (already done)
2. Deploy with `pnpm deploy` from worker directory
3. Durable Objects migration will create new RateLimitDO class

## Security Considerations

1. **IP Spoofing**: Uses `CF-Connecting-IP` which Cloudflare validates
2. **Distributed Attacks**: Sharding prevents single DO bottleneck
3. **Bypass Attempts**: Rate limits applied before all other middleware
4. **Failsafe**: If RateLimitDO fails, requests are allowed (logs error)

## Performance

- SQLite queries are fast (~1ms)
- Sharding distributes load across 10 instances
- Automatic cleanup prevents unbounded growth
- Headers add minimal overhead (~100 bytes)

## Future Enhancements

- [ ] Per-endpoint rate limits (e.g., `/api/search` has different limit than `/api/repos`)
- [ ] Burst allowance (allow brief spikes)
- [ ] User-specific limits (premium users get higher limits)
- [ ] Rate limit analytics dashboard
- [ ] Automatic ban on repeated violations
