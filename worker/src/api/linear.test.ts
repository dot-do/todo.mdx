/**
 * Tests for Linear webhook signature verification
 */

import { describe, it, expect } from 'vitest'

/**
 * Test implementation of Linear signature verification
 * This mirrors the implementation in linear.ts
 */
async function verifyLinearSignature(
  body: string,
  signature: string | undefined,
  secret: string
): Promise<boolean> {
  if (!signature) {
    return false
  }

  try {
    const encoder = new TextEncoder()

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    )

    const expectedSignature = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    return timingSafeEqual(expectedSignature, signature.toLowerCase())
  } catch (error) {
    return false
  }
}

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

describe('Linear Webhook Signature Verification', () => {
  it('should verify valid signature', async () => {
    const secret = 'test-secret-key'
    const body = '{"type":"Issue","action":"create","data":{"id":"123"}}'

    // Generate expected signature
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    )

    const signature = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    // Verify the signature
    const isValid = await verifyLinearSignature(body, signature, secret)
    expect(isValid).toBe(true)
  })

  it('should reject invalid signature', async () => {
    const secret = 'test-secret-key'
    const body = '{"type":"Issue","action":"create","data":{"id":"123"}}'
    const invalidSignature = 'invalid-signature-1234567890abcdef'

    const isValid = await verifyLinearSignature(body, invalidSignature, secret)
    expect(isValid).toBe(false)
  })

  it('should reject missing signature', async () => {
    const secret = 'test-secret-key'
    const body = '{"type":"Issue","action":"create","data":{"id":"123"}}'

    const isValid = await verifyLinearSignature(body, undefined, secret)
    expect(isValid).toBe(false)
  })

  it('should reject signature with wrong secret', async () => {
    const secret = 'test-secret-key'
    const wrongSecret = 'wrong-secret-key'
    const body = '{"type":"Issue","action":"create","data":{"id":"123"}}'

    // Generate signature with correct secret
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    )

    const signature = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    // Try to verify with wrong secret
    const isValid = await verifyLinearSignature(body, signature, wrongSecret)
    expect(isValid).toBe(false)
  })

  it('should reject signature with modified body', async () => {
    const secret = 'test-secret-key'
    const body = '{"type":"Issue","action":"create","data":{"id":"123"}}'
    const modifiedBody = '{"type":"Issue","action":"create","data":{"id":"456"}}'

    // Generate signature for original body
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    )

    const signature = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    // Try to verify with modified body
    const isValid = await verifyLinearSignature(modifiedBody, signature, secret)
    expect(isValid).toBe(false)
  })

  it('should handle uppercase and lowercase signatures equally', async () => {
    const secret = 'test-secret-key'
    const body = '{"type":"Issue","action":"create","data":{"id":"123"}}'

    // Generate signature
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    )

    const signature = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    // Verify with lowercase
    const isValidLower = await verifyLinearSignature(body, signature.toLowerCase(), secret)
    expect(isValidLower).toBe(true)

    // Verify with uppercase
    const isValidUpper = await verifyLinearSignature(body, signature.toUpperCase(), secret)
    expect(isValidUpper).toBe(true)
  })
})

describe('Timing Safe Comparison', () => {
  it('should return true for equal strings', () => {
    expect(timingSafeEqual('abc123', 'abc123')).toBe(true)
  })

  it('should return false for different strings of same length', () => {
    expect(timingSafeEqual('abc123', 'abc124')).toBe(false)
  })

  it('should return false for strings of different length', () => {
    expect(timingSafeEqual('abc123', 'abc12')).toBe(false)
    expect(timingSafeEqual('abc12', 'abc123')).toBe(false)
  })

  it('should return false for empty vs non-empty string', () => {
    expect(timingSafeEqual('', 'abc')).toBe(false)
    expect(timingSafeEqual('abc', '')).toBe(false)
  })

  it('should return true for empty strings', () => {
    expect(timingSafeEqual('', '')).toBe(true)
  })
})
