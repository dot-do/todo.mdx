/**
 * Linear Webhook Handler Tests
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  verifyLinearSignature,
  isTimestampValid,
  type LinearIssueWebhook,
  type LinearCommentWebhook,
} from '../linear'

describe('Linear Webhook Signature Verification', () => {
  const secret = 'test-webhook-secret'

  it('should verify a valid signature', async () => {
    const body = JSON.stringify({ type: 'Issue', action: 'create' })

    // Generate expected signature using the same algorithm
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
    const validSignature = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    const result = await verifyLinearSignature(body, validSignature, secret)
    expect(result).toBe(true)
  })

  it('should reject an invalid signature', async () => {
    const body = JSON.stringify({ type: 'Issue', action: 'create' })
    const invalidSignature = 'abcd1234invalid5678signature'

    const result = await verifyLinearSignature(body, invalidSignature, secret)
    expect(result).toBe(false)
  })

  it('should reject missing signature', async () => {
    const body = JSON.stringify({ type: 'Issue', action: 'create' })

    const result = await verifyLinearSignature(body, undefined, secret)
    expect(result).toBe(false)
  })

  it('should reject signature with wrong length', async () => {
    const body = JSON.stringify({ type: 'Issue', action: 'create' })
    const shortSignature = 'abc'

    const result = await verifyLinearSignature(body, shortSignature, secret)
    expect(result).toBe(false)
  })
})

describe('Timestamp Validation', () => {
  it('should accept timestamp within 1 minute', () => {
    const now = Date.now()
    const thirtySecondsAgo = now - 30_000

    expect(isTimestampValid(thirtySecondsAgo)).toBe(true)
  })

  it('should accept exact current timestamp', () => {
    const now = Date.now()

    expect(isTimestampValid(now)).toBe(true)
  })

  it('should accept timestamp 59 seconds ago', () => {
    const now = Date.now()
    const fiftyNineSecondsAgo = now - 59_000

    expect(isTimestampValid(fiftyNineSecondsAgo)).toBe(true)
  })

  it('should reject timestamp more than 1 minute ago', () => {
    const now = Date.now()
    const twoMinutesAgo = now - 120_000

    expect(isTimestampValid(twoMinutesAgo)).toBe(false)
  })

  it('should accept timestamp slightly in the future (clock skew)', () => {
    const now = Date.now()
    const thirtySecondsAhead = now + 30_000

    expect(isTimestampValid(thirtySecondsAhead)).toBe(true)
  })
})

describe('Linear Webhook Payload Types', () => {
  it('should have correct Issue webhook structure', () => {
    const issuePayload: LinearIssueWebhook = {
      action: 'create',
      type: 'Issue',
      createdAt: new Date().toISOString(),
      data: {
        id: 'issue-123',
        identifier: 'ABC-123',
        title: 'Test Issue',
        description: 'Test description',
        priority: 2,
        state: {
          id: 'state-1',
          name: 'In Progress',
          type: 'started',
          color: '#00ff00',
        },
        team: {
          id: 'team-1',
          key: 'ABC',
          name: 'Test Team',
        },
        url: 'https://linear.app/test/issue/ABC-123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      url: 'https://linear.app/test/issue/ABC-123',
      webhookTimestamp: Date.now(),
      webhookId: 'webhook-123',
      organizationId: 'org-123',
    }

    expect(issuePayload.type).toBe('Issue')
    expect(issuePayload.action).toBe('create')
    expect(issuePayload.data.identifier).toBe('ABC-123')
  })

  it('should have correct Comment webhook structure', () => {
    const commentPayload: LinearCommentWebhook = {
      action: 'create',
      type: 'Comment',
      createdAt: new Date().toISOString(),
      data: {
        id: 'comment-123',
        body: 'This is a test comment',
        issue: {
          id: 'issue-123',
          identifier: 'ABC-123',
        },
        user: {
          id: 'user-1',
          name: 'Test User',
          email: 'test@example.com',
        },
        url: 'https://linear.app/test/issue/ABC-123#comment-123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      url: 'https://linear.app/test/issue/ABC-123',
      webhookTimestamp: Date.now(),
      webhookId: 'webhook-456',
      organizationId: 'org-123',
    }

    expect(commentPayload.type).toBe('Comment')
    expect(commentPayload.action).toBe('create')
    expect(commentPayload.data.body).toBe('This is a test comment')
  })
})
