/**
 * GitHub Webhook Handler with HMAC-SHA256 Signature Verification
 *
 * Implements secure webhook handling for GitHub Apps using Web Crypto API
 * for compatibility with Cloudflare Workers.
 */

export interface WebhookEvent {
  event: string // e.g., 'issues', 'installation'
  action: string // e.g., 'opened', 'edited', 'closed'
  deliveryId: string // X-GitHub-Delivery header
  payload: any // Parsed JSON payload
}

/**
 * Verify GitHub webhook signature using HMAC-SHA256
 *
 * Uses Web Crypto API for Cloudflare Workers compatibility.
 * Implements constant-time comparison to prevent timing attacks.
 *
 * @param payload - The raw webhook payload string
 * @param signature - The signature from X-Hub-Signature-256 header (format: "sha256=<hex>")
 * @param secret - The webhook secret configured in GitHub
 * @returns Promise resolving to true if signature is valid
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) {
    return false
  }

  // Extract hex digest from "sha256=<hex>" format
  if (!signature.startsWith('sha256=')) {
    return false
  }

  const receivedSignature = signature.slice(7) // Remove "sha256=" prefix

  // Compute HMAC-SHA256 using Web Crypto API
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(payload)

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData)

  // Convert ArrayBuffer to hex string
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  // Constant-time comparison to prevent timing attacks
  return constantTimeCompare(computedSignature, receivedSignature)
}

/**
 * Constant-time string comparison to prevent timing attacks
 *
 * Compares two strings character by character without early exit,
 * ensuring the comparison always takes the same amount of time
 * regardless of where differences occur.
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

/**
 * Parse and extract GitHub webhook headers
 *
 * @param headers - HTTP headers object
 * @returns Parsed event, delivery ID, and signature
 */
export function parseWebhookHeaders(headers: {
  'x-github-event'?: string
  'x-github-delivery'?: string
  'x-hub-signature-256'?: string
}): { event: string; deliveryId: string; signature: string | null } {
  return {
    event: headers['x-github-event'] || '',
    deliveryId: headers['x-github-delivery'] || '',
    signature: headers['x-hub-signature-256'] || null,
  }
}

/**
 * Create a Hono middleware for GitHub webhooks
 *
 * This handler:
 * 1. Parses webhook headers
 * 2. Verifies HMAC-SHA256 signature
 * 3. Validates required headers are present
 * 4. Calls the provided event handler with parsed webhook data
 *
 * @param options - Configuration options
 * @param options.secret - GitHub webhook secret for signature verification
 * @param options.onEvent - Async callback to handle webhook events
 * @returns Hono request handler function
 */
export function createWebhookHandler(options: {
  secret: string
  onEvent: (event: WebhookEvent) => Promise<void>
}): (c: any) => Promise<Response> {
  const { secret, onEvent } = options

  return async (c: any): Promise<Response> => {
    // Parse headers
    const headers = {
      'x-github-event': c.req.header('x-github-event'),
      'x-github-delivery': c.req.header('x-github-delivery'),
      'x-hub-signature-256': c.req.header('x-hub-signature-256'),
    }

    const { event, deliveryId, signature } = parseWebhookHeaders(headers)

    // Validate required headers
    if (!event) {
      return new Response(
        JSON.stringify({ error: 'Missing x-github-event header' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!deliveryId) {
      return new Response(
        JSON.stringify({ error: 'Missing x-github-delivery header' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get raw payload
    const payloadText = await c.req.text()

    // Verify signature
    const isValid = await verifyWebhookSignature(payloadText, signature, secret)

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Parse payload
    let payload: any
    try {
      payload = JSON.parse(payloadText)
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Extract action from payload
    const action = payload.action || ''

    // Call event handler
    try {
      await onEvent({
        event,
        action,
        deliveryId,
        payload,
      })

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    } catch (error) {
      console.error('Error handling webhook event:', error)
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }
}
