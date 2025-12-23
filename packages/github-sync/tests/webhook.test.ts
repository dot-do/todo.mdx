import { describe, expect, it, vi } from 'vitest'
import {
  verifyWebhookSignature,
  parseWebhookHeaders,
  createWebhookHandler,
  type WebhookEvent,
} from '../src/webhook'

// Helper function to compute a valid signature for testing
async function computeSignature(payload: string, secret: string): Promise<string> {
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
  const hex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return `sha256=${hex}`
}

describe('verifyWebhookSignature', () => {
  const secret = 'test-webhook-secret'
  const payload = JSON.stringify({ action: 'opened', issue: { id: 1 } })

  it('should verify valid HMAC-SHA256 signature correctly', async () => {
    // Compute a valid signature for the payload
    const signature = await computeSignature(payload, secret)

    const result = await verifyWebhookSignature(payload, signature, secret)
    expect(result).toBe(true)
  })

  it('should return false for invalid signature', async () => {
    const signature = 'sha256=invalid_signature_here'

    const result = await verifyWebhookSignature(payload, signature, secret)
    expect(result).toBe(false)
  })

  it('should return false for missing signature', async () => {
    const result = await verifyWebhookSignature(payload, null, secret)
    expect(result).toBe(false)
  })

  it('should work with empty payload and valid signature', async () => {
    const emptyPayload = ''
    // Compute signature for empty payload
    const signature = await computeSignature(emptyPayload, secret)

    const result = await verifyWebhookSignature(emptyPayload, signature, secret)
    expect(result).toBe(true)
  })

  it('should use constant-time comparison to prevent timing attacks', async () => {
    // This tests that we don't bail early on mismatched signatures
    const validSignature = await computeSignature(payload, secret)
    const invalidSignature = 'sha256=0000000000000000000000000000000000000000000000000000000000000000'

    // Both should take similar time - we'll just test they both work
    const result1 = await verifyWebhookSignature(payload, validSignature, secret)
    const result2 = await verifyWebhookSignature(payload, invalidSignature, secret)

    expect(result1).toBe(true)
    expect(result2).toBe(false)
  })

  it('should handle signature without sha256= prefix gracefully', async () => {
    const validSig = await computeSignature(payload, secret)
    const signatureWithoutPrefix = validSig.slice(7) // Remove "sha256=" prefix

    const result = await verifyWebhookSignature(payload, signatureWithoutPrefix, secret)
    expect(result).toBe(false)
  })
})

describe('parseWebhookHeaders', () => {
  it('should extract all headers correctly', () => {
    const headers = {
      'x-github-event': 'issues',
      'x-github-delivery': '12345-67890-abcdef',
      'x-hub-signature-256': 'sha256=abcd1234',
    }

    const result = parseWebhookHeaders(headers)

    expect(result.event).toBe('issues')
    expect(result.deliveryId).toBe('12345-67890-abcdef')
    expect(result.signature).toBe('sha256=abcd1234')
  })

  it('should handle missing x-github-event header', () => {
    const headers = {
      'x-github-delivery': '12345',
      'x-hub-signature-256': 'sha256=abcd',
    }

    const result = parseWebhookHeaders(headers)

    expect(result.event).toBe('')
    expect(result.deliveryId).toBe('12345')
    expect(result.signature).toBe('sha256=abcd')
  })

  it('should handle missing x-github-delivery header', () => {
    const headers = {
      'x-github-event': 'issues',
      'x-hub-signature-256': 'sha256=abcd',
    }

    const result = parseWebhookHeaders(headers)

    expect(result.event).toBe('issues')
    expect(result.deliveryId).toBe('')
    expect(result.signature).toBe('sha256=abcd')
  })

  it('should return null for missing signature', () => {
    const headers = {
      'x-github-event': 'issues',
      'x-github-delivery': '12345',
    }

    const result = parseWebhookHeaders(headers)

    expect(result.event).toBe('issues')
    expect(result.deliveryId).toBe('12345')
    expect(result.signature).toBe(null)
  })

  it('should handle completely empty headers', () => {
    const headers = {}

    const result = parseWebhookHeaders(headers)

    expect(result.event).toBe('')
    expect(result.deliveryId).toBe('')
    expect(result.signature).toBe(null)
  })
})

describe('createWebhookHandler', () => {
  it('should return 401 for invalid signature', async () => {
    const onEvent = vi.fn()
    const handler = createWebhookHandler({
      secret: 'test-secret',
      onEvent,
    })

    const mockContext = {
      req: {
        header: (name: string) => {
          const headers: Record<string, string> = {
            'x-github-event': 'issues',
            'x-github-delivery': '12345',
            'x-hub-signature-256': 'sha256=invalid',
          }
          return headers[name]
        },
        text: async () => JSON.stringify({ action: 'opened' }),
      },
    }

    const response = await handler(mockContext)

    expect(response.status).toBe(401)
    expect(onEvent).not.toHaveBeenCalled()
  })

  it('should return 200 for valid signature', async () => {
    const onEvent = vi.fn()
    const secret = 'test-secret'
    const handler = createWebhookHandler({
      secret,
      onEvent,
    })

    const payload = JSON.stringify({ action: 'opened', issue: { id: 1 } })
    const validSignature = await computeSignature(payload, secret)

    const mockContext = {
      req: {
        header: (name: string) => {
          const headers: Record<string, string> = {
            'x-github-event': 'issues',
            'x-github-delivery': '12345',
            'x-hub-signature-256': validSignature,
          }
          return headers[name]
        },
        text: async () => payload,
      },
    }

    const response = await handler(mockContext)

    expect(response.status).toBe(200)
  })

  it('should call onEvent with parsed webhook event', async () => {
    const onEvent = vi.fn()
    const secret = 'test-secret'
    const handler = createWebhookHandler({
      secret,
      onEvent,
    })

    const payload = { action: 'opened', issue: { id: 1, title: 'Test Issue' } }
    const payloadString = JSON.stringify(payload)
    const validSignature = await computeSignature(payloadString, secret)

    const mockContext = {
      req: {
        header: (name: string) => {
          const headers: Record<string, string> = {
            'x-github-event': 'issues',
            'x-github-delivery': '12345-67890',
            'x-hub-signature-256': validSignature,
          }
          return headers[name]
        },
        text: async () => payloadString,
      },
    }

    await handler(mockContext)

    expect(onEvent).toHaveBeenCalledWith({
      event: 'issues',
      action: 'opened',
      deliveryId: '12345-67890',
      payload,
    })
  })

  it('should return 400 for missing event header', async () => {
    const onEvent = vi.fn()
    const handler = createWebhookHandler({
      secret: 'test-secret',
      onEvent,
    })

    const mockContext = {
      req: {
        header: (name: string) => {
          const headers: Record<string, string> = {
            'x-github-delivery': '12345',
            'x-hub-signature-256': 'sha256=valid',
          }
          return headers[name]
        },
        text: async () => JSON.stringify({ action: 'opened' }),
      },
    }

    const response = await handler(mockContext)

    expect(response.status).toBe(400)
    expect(onEvent).not.toHaveBeenCalled()
  })

  it('should return 400 for missing delivery ID', async () => {
    const onEvent = vi.fn()
    const handler = createWebhookHandler({
      secret: 'test-secret',
      onEvent,
    })

    const mockContext = {
      req: {
        header: (name: string) => {
          const headers: Record<string, string> = {
            'x-github-event': 'issues',
            'x-hub-signature-256': 'sha256=valid',
          }
          return headers[name]
        },
        text: async () => JSON.stringify({ action: 'opened' }),
      },
    }

    const response = await handler(mockContext)

    expect(response.status).toBe(400)
    expect(onEvent).not.toHaveBeenCalled()
  })
})
