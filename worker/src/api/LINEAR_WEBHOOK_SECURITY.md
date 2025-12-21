# Linear Webhook Security

## Overview

The Linear webhook handler (`/api/linear/webhook`) implements proper signature verification to prevent spoofed webhook requests that could corrupt data.

## Signature Verification

### How It Works

1. **Signature Header**: Linear sends webhooks with a `Linear-Signature` header
2. **Algorithm**: The signature is an HMAC-SHA256 hash of the raw request body
3. **Secret**: The signature is computed using your `LINEAR_WEBHOOK_SECRET`
4. **Verification**: The worker recomputes the signature and compares it with the provided one

### Implementation Details

```typescript
// Linear sends the signature in the header
const signature = request.headers.get('Linear-Signature')

// We compute the expected signature using HMAC-SHA256
const encoder = new TextEncoder()
const key = await crypto.subtle.importKey(
  'raw',
  encoder.encode(LINEAR_WEBHOOK_SECRET),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign']
)

const signatureBytes = await crypto.subtle.sign(
  'HMAC',
  key,
  encoder.encode(rawBody)
)

// Convert to hex string
const expectedSignature = Array.from(new Uint8Array(signatureBytes))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('')

// Compare using timing-safe comparison
timingSafeEqual(expectedSignature, signature.toLowerCase())
```

### Timing-Safe Comparison

To prevent timing attacks, we use a constant-time comparison function:

```typescript
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}
```

This ensures that the comparison time doesn't leak information about which characters match.

## Configuration

### Setting the Webhook Secret

```bash
# Set the webhook secret via wrangler
cd worker
wrangler secret put LINEAR_WEBHOOK_SECRET
# Enter your webhook secret from Linear settings
```

### Webhook Without Secret (Development Only)

If `LINEAR_WEBHOOK_SECRET` is not set, the webhook handler will:
1. Log a warning about the security risk
2. Accept the webhook without verification
3. Process the event normally

**This is only for development. Never run production without a webhook secret.**

## Security Features

1. **HMAC-SHA256**: Industry-standard signature algorithm
2. **Raw Body Verification**: Signature computed over the exact bytes received
3. **Timing-Safe Comparison**: Prevents timing attack vectors
4. **Case-Insensitive**: Handles both uppercase and lowercase hex signatures
5. **Early Rejection**: Invalid signatures return 401 before processing

## Testing

Run the signature verification tests:

```bash
pnpm exec vitest run worker/src/api/linear.test.ts
```

Tests cover:
- Valid signature verification
- Invalid signature rejection
- Missing signature rejection
- Wrong secret rejection
- Modified body detection
- Case-insensitive comparison
- Timing-safe comparison edge cases

## Linear Webhook Setup

1. Go to https://linear.app/settings/api/webhooks
2. Click "Create new webhook"
3. Set URL: `https://your-worker.workers.dev/api/linear/webhook`
4. Select events to subscribe to:
   - Issue (create, update, remove)
   - Cycle (create, update, remove)
   - Project (create, update, remove)
5. Copy the webhook secret
6. Set it via `wrangler secret put LINEAR_WEBHOOK_SECRET`

## Error Handling

### Invalid Signature

```json
{
  "error": "Invalid webhook signature",
  "message": "Webhook signature verification failed"
}
```

Returns HTTP 401 Unauthorized

### Invalid JSON

```json
{
  "error": "Invalid JSON payload"
}
```

Returns HTTP 400 Bad Request

### Missing Integration

```json
{
  "status": "ignored",
  "reason": "No active integration found"
}
```

Returns HTTP 200 (webhook acknowledged but not processed)

## Monitoring

The webhook handler logs:
- Signature verification success/failure
- Webhook type and action
- Organization ID and webhook ID
- Processing results for each event type

Check worker logs for webhook activity:

```bash
wrangler tail
```

## Security Best Practices

1. **Always set LINEAR_WEBHOOK_SECRET in production**
2. **Rotate webhook secrets periodically**
3. **Monitor webhook logs for suspicious activity**
4. **Use HTTPS for webhook endpoints**
5. **Verify the organizationId matches expected integrations**

## References

- [Linear Webhook Documentation](https://developers.linear.app/docs/graphql/webhooks)
- [HMAC-SHA256 Specification](https://datatracker.ietf.org/doc/html/rfc2104)
- [Cloudflare Workers Web Crypto API](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)
