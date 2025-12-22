/**
 * TDD Tests for Access Control Functions
 *
 * These tests define the DESIRED behavior (RED phase).
 */

import { describe, it, expect } from 'vitest'
import { isInternalRequest, internalOrAdmin, withInternalAccess } from './internal'
import type { PayloadRequest, AccessArgs } from 'payload'

// Helper to create mock request with headers
function createMockRequest(options: {
  headers?: Record<string, string> | Headers
  user?: { roles?: string[] } | null
}): PayloadRequest {
  return {
    headers: options.headers ?? new Headers(),
    user: options.user ?? null,
  } as unknown as PayloadRequest
}

describe('isInternalRequest', () => {
  it('returns true when x-payload-internal header is "true" (Headers object)', () => {
    const headers = new Headers()
    headers.set('x-payload-internal', 'true')
    const req = createMockRequest({ headers })

    expect(isInternalRequest(req)).toBe(true)
  })

  it('returns true when x-payload-internal header is "true" (plain object)', () => {
    const req = createMockRequest({
      headers: { 'x-payload-internal': 'true' } as unknown as Headers,
    })

    expect(isInternalRequest(req)).toBe(true)
  })

  it('returns true when X-Payload-Internal header is "true" (capitalized)', () => {
    const req = createMockRequest({
      headers: { 'X-Payload-Internal': 'true' } as unknown as Headers,
    })

    expect(isInternalRequest(req)).toBe(true)
  })

  it('returns false when header is missing', () => {
    const req = createMockRequest({})

    expect(isInternalRequest(req)).toBe(false)
  })

  it('returns false when header value is not "true"', () => {
    const headers = new Headers()
    headers.set('x-payload-internal', 'false')
    const req = createMockRequest({ headers })

    expect(isInternalRequest(req)).toBe(false)
  })

  it('returns false when headers is null', () => {
    const req = { headers: null } as unknown as PayloadRequest

    expect(isInternalRequest(req)).toBe(false)
  })
})

describe('internalOrAdmin', () => {
  it('returns true for internal requests', () => {
    const headers = new Headers()
    headers.set('x-payload-internal', 'true')
    const req = createMockRequest({ headers })

    expect(internalOrAdmin({ req } as AccessArgs)).toBe(true)
  })

  it('returns true for admin users', () => {
    const req = createMockRequest({
      user: { roles: ['admin'] },
    })

    expect(internalOrAdmin({ req } as AccessArgs)).toBe(true)
  })

  it('returns false for non-admin users', () => {
    const req = createMockRequest({
      user: { roles: ['user'] },
    })

    expect(internalOrAdmin({ req } as AccessArgs)).toBe(false)
  })

  it('returns false for users with no roles', () => {
    const req = createMockRequest({
      user: { roles: [] },
    })

    expect(internalOrAdmin({ req } as AccessArgs)).toBe(false)
  })

  it('returns false for unauthenticated requests', () => {
    const req = createMockRequest({ user: null })

    expect(internalOrAdmin({ req } as AccessArgs)).toBe(false)
  })
})

describe('withInternalAccess', () => {
  it('returns true for internal requests without calling wrapped function', async () => {
    let wasCalled = false
    const wrappedFn = () => {
      wasCalled = true
      return false
    }

    const headers = new Headers()
    headers.set('x-payload-internal', 'true')
    const req = createMockRequest({ headers })

    const accessFn = withInternalAccess(wrappedFn)
    const result = await accessFn({ req } as AccessArgs)

    expect(result).toBe(true)
    expect(wasCalled).toBe(false)
  })

  it('calls wrapped function for non-internal requests', async () => {
    let wasCalled = false
    const wrappedFn = () => {
      wasCalled = true
      return { field: { equals: 'value' } }
    }

    const req = createMockRequest({})

    const accessFn = withInternalAccess(wrappedFn)
    const result = await accessFn({ req } as AccessArgs)

    expect(wasCalled).toBe(true)
    expect(result).toEqual({ field: { equals: 'value' } })
  })

  it('handles async wrapped functions', async () => {
    const wrappedFn = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1))
      return true
    }

    const req = createMockRequest({})

    const accessFn = withInternalAccess(wrappedFn)
    const result = await accessFn({ req } as AccessArgs)

    expect(result).toBe(true)
  })
})
