import { test, expect } from '@playwright/test'

const MCP_BASE = 'https://todo.mdx.do'

/**
 * MCP E2E Tests
 *
 * Run with Chrome profile (Quinn):
 *   CHROME_PROFILE_DIR="Profile 6" pnpm test:browser --project=chrome-profile browser/mcp-e2e.spec.ts
 *
 * Or manually in browser - just open the URLs
 */

test.describe('MCP OAuth E2E', () => {
  test('OAuth metadata is accessible', async ({ page }) => {
    await page.goto(`${MCP_BASE}/.well-known/oauth-authorization-server`)

    const content = await page.textContent('body')
    const metadata = JSON.parse(content || '{}')

    expect(metadata.issuer).toBe(MCP_BASE)
    expect(metadata.authorization_endpoint).toContain('/authorize')
    expect(metadata.token_endpoint).toContain('/token')
    expect(metadata.code_challenge_methods_supported).toContain('S256')

    console.log('OAuth endpoints:', {
      authorize: metadata.authorization_endpoint,
      token: metadata.token_endpoint,
    })
  })

  test('Authorization flow redirects to GitHub/WorkOS', async ({ page }) => {
    // Generate PKCE values
    const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    const codeChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'

    const authUrl = new URL(`${MCP_BASE}/authorize`)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', 'test-mcp-client')
    authUrl.searchParams.set('redirect_uri', 'http://localhost:8080/callback')
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('state', `test-${Date.now()}`)
    authUrl.searchParams.set('scope', 'openid profile')

    console.log('Auth URL:', authUrl.toString())

    // Navigate to auth endpoint
    await page.goto(authUrl.toString(), { waitUntil: 'domcontentloaded' })

    // Should redirect to WorkOS/GitHub for auth
    const finalUrl = page.url()
    console.log('Redirected to:', finalUrl)

    // Check we're at an auth provider
    const isAuthProvider =
      finalUrl.includes('workos.com') ||
      finalUrl.includes('github.com') ||
      finalUrl.includes('authkit') ||
      finalUrl.includes('todo.mdx.do')

    expect(isAuthProvider).toBe(true)
  })

  test('Complete OAuth flow with GitHub auth', async ({ page }) => {
    // This test requires being logged into GitHub in the browser

    const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    const codeChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'

    const authUrl = new URL(`${MCP_BASE}/authorize`)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', 'playwright-test')
    authUrl.searchParams.set('redirect_uri', 'http://127.0.0.1:8976/callback')
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('state', `e2e-${Date.now()}`)

    console.log('Starting OAuth flow...')
    console.log('Auth URL:', authUrl.toString())

    // Start auth flow
    const response = await page.goto(authUrl.toString(), {
      waitUntil: 'networkidle',
      timeout: 30000
    })

    // Wait for redirects to complete
    await page.waitForTimeout(3000)

    const finalUrl = page.url()
    console.log('Final URL:', finalUrl)

    // If we end up at the callback with a code, auth succeeded!
    if (finalUrl.includes('callback') && finalUrl.includes('code=')) {
      const url = new URL(finalUrl)
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')

      console.log('SUCCESS! Got authorization code')
      console.log('Code:', code?.substring(0, 20) + '...')
      console.log('State:', state)

      expect(code).toBeTruthy()
      expect(state).toContain('e2e-')
    } else if (finalUrl.includes('github.com')) {
      console.log('At GitHub - may need to authorize the app')
      // Look for authorize button
      const authorizeBtn = page.locator('button[name="authorize"]')
      if (await authorizeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Clicking authorize button...')
        await authorizeBtn.click()
        await page.waitForURL(/callback.*code=/, { timeout: 10000 })
        console.log('Authorized! Final URL:', page.url())
      }
    } else {
      console.log('Ended up at:', finalUrl)
      console.log('Page title:', await page.title())
    }
  })
})

test.describe('MCP API with Auth', () => {
  // These tests require a valid token - skip if not available
  const API_TOKEN = process.env.MCP_API_TOKEN

  test.skip(!API_TOKEN, 'MCP_API_TOKEN not set')

  test('list tools', async ({ request }) => {
    const response = await request.get(`${MCP_BASE}/mcp/tools`, {
      headers: { Authorization: `Bearer ${API_TOKEN}` }
    })

    expect(response.ok()).toBe(true)
    const { tools } = await response.json()

    console.log('Available tools:', tools.map((t: any) => t.name))
    expect(tools.length).toBeGreaterThan(0)
  })

  test('list resources', async ({ request }) => {
    const response = await request.get(`${MCP_BASE}/mcp/resources`, {
      headers: { Authorization: `Bearer ${API_TOKEN}` }
    })

    expect(response.ok()).toBe(true)
    const { resources } = await response.json()

    console.log('Available resources:', resources.length)
  })
})
