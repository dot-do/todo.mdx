import { describe, test, expect } from 'vitest'

/**
 * E2E tests for admin.mdx.do site (Payload CMS + D1 + OpenNext)
 *
 * Tests that the deployed admin dashboard is accessible and returns proper responses.
 * The /admin path should load the Payload CMS admin panel.
 */

const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL || 'https://admin.mdx.do'

describe('admin.mdx.do Payload admin panel', () => {
  test('admin panel returns 200 with valid HTML', async () => {
    const response = await fetch(`${ADMIN_BASE_URL}/admin`)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')

    const html = await response.text()
    expect(html).toContain('<!DOCTYPE html')
  })

  test('admin login page is accessible', async () => {
    const response = await fetch(`${ADMIN_BASE_URL}/admin/login`)

    // Should return 200 or redirect to /admin (depending on auth state)
    expect(response.status).not.toBe(500)
    expect([200, 301, 302, 303, 307, 308]).toContain(response.status)
  })

  test('admin API health check does not return 500', async () => {
    const response = await fetch(`${ADMIN_BASE_URL}/api/users`, {
      redirect: 'manual',
    })

    // Should return 401/403 (unauthorized) or redirect, not 500
    expect(response.status).not.toBe(500)
  })
})

describe('admin.mdx.do error handling', () => {
  test('non-existent page returns 404, not 500', async () => {
    const response = await fetch(`${ADMIN_BASE_URL}/this-page-does-not-exist-12345`)

    expect(response.status).toBe(404)
  })
})
