import { describe, test, expect } from 'vitest'

/**
 * E2E tests for todo.mdx.do site (Fumadocs + WorkOS AuthKit + OpenNext)
 *
 * Tests that the deployed site is accessible and returns proper responses.
 * Homepage and /docs should be publicly accessible (unauthenticated).
 */

const SITE_BASE_URL = process.env.SITE_BASE_URL || 'https://todo.mdx.do'

describe('todo.mdx.do site public pages', () => {
  test('homepage returns 200 with valid HTML', async () => {
    const response = await fetch(SITE_BASE_URL)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')

    const html = await response.text()
    expect(html).toContain('<!DOCTYPE html')
    expect(html).toContain('todo.mdx')
  })

  test('documentation page returns 200', async () => {
    const response = await fetch(`${SITE_BASE_URL}/docs`)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
  })

  test('documentation components page returns 200', async () => {
    const response = await fetch(`${SITE_BASE_URL}/docs/components`)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')

    const html = await response.text()
    expect(html).toContain('todo.mdx')
  })

  test('static assets are served', async () => {
    // Check that Next.js static file serving works
    const response = await fetch(`${SITE_BASE_URL}/favicon.ico`)

    // favicon.ico might not exist, but we should get a proper response, not 500
    expect(response.status).not.toBe(500)
  })
})

describe('todo.mdx.do site protected pages', () => {
  test('dashboard redirects to auth when unauthenticated', async () => {
    const response = await fetch(`${SITE_BASE_URL}/dashboard`, {
      redirect: 'manual',
    })

    // Should redirect to WorkOS auth, not return 500
    expect(response.status).not.toBe(500)

    // Either 302 redirect or 200 with login page
    expect([200, 301, 302, 303, 307, 308]).toContain(response.status)
  })
})

describe('todo.mdx.do site error handling', () => {
  test('non-existent page returns 404, not 500', async () => {
    const response = await fetch(`${SITE_BASE_URL}/this-page-does-not-exist-12345`)

    expect(response.status).toBe(404)
  })
})
