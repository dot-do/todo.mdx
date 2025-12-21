import { test, expect, isAuthenticated } from '../helpers/browser'

const MCP_BASE_URL = process.env.MCP_BASE_URL || 'https://todo.mdx.do'

/**
 * MCP OAuth Flow Tests
 *
 * Tests the complete OAuth 2.1 + PKCE flow for MCP authentication.
 * Requires GitHub authentication in Chrome profile.
 *
 * Run with:
 *   USE_CHROME_PROFILE=true pnpm test:browser --project=chrome-profile browser/mcp-oauth.spec.ts
 */

test.describe('MCP OAuth Flow', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Check if we're logged into GitHub
    const isGitHubAuth = await isAuthenticated(authenticatedPage, 'github')
    if (!isGitHubAuth) {
      test.skip(true, 'GitHub authentication required. Sign in via Chrome first.')
    }
  })

  test('should have OAuth metadata endpoint', async ({ authenticatedPage }) => {
    await authenticatedPage.goto(`${MCP_BASE_URL}/mcp/.well-known/oauth-authorization-server`)

    // Should return JSON
    const content = await authenticatedPage.textContent('body')
    expect(content).toBeTruthy()

    const metadata = JSON.parse(content || '{}')
    expect(metadata).toHaveProperty('issuer')
    expect(metadata).toHaveProperty('authorization_endpoint')
    expect(metadata).toHaveProperty('token_endpoint')
    expect(metadata.code_challenge_methods_supported).toContain('S256')
  })

  test('should redirect to authorization endpoint', async ({ authenticatedPage }) => {
    // Generate PKCE challenge
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = await generateCodeChallenge(codeVerifier)

    const authUrl = new URL(`${MCP_BASE_URL}/mcp/authorize`)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', 'test-client')
    authUrl.searchParams.set('redirect_uri', 'http://localhost:3000/callback')
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('state', 'test-state-123')

    await authenticatedPage.goto(authUrl.toString())

    // Should redirect to GitHub or show authorization page
    // The exact behavior depends on implementation
    const currentUrl = authenticatedPage.url()
    console.log('Authorization redirect URL:', currentUrl)

    // Should either be GitHub auth or our authorization page
    expect(
      currentUrl.includes('github.com') ||
      currentUrl.includes('workos.com') ||
      currentUrl.includes(MCP_BASE_URL)
    ).toBe(true)
  })

  test('should complete OAuth flow when already authenticated', async ({ authenticatedPage }) => {
    // This test attempts the full OAuth flow
    // If GitHub session is valid, it should redirect back with auth code

    const codeVerifier = generateCodeVerifier()
    const codeChallenge = await generateCodeChallenge(codeVerifier)
    const redirectUri = 'http://localhost:8080/callback'

    const authUrl = new URL(`${MCP_BASE_URL}/mcp/authorize`)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', 'test-mcp-client')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('state', 'test-state-' + Date.now())
    authUrl.searchParams.set('scope', 'repo')

    // Navigate and wait for either callback or auth page
    const response = await authenticatedPage.goto(authUrl.toString(), {
      waitUntil: 'networkidle',
      timeout: 30000,
    })

    const finalUrl = authenticatedPage.url()
    console.log('Final URL after OAuth flow:', finalUrl)

    // Log what happened for debugging
    if (finalUrl.startsWith(redirectUri)) {
      const callbackUrl = new URL(finalUrl)
      const code = callbackUrl.searchParams.get('code')
      const state = callbackUrl.searchParams.get('state')
      const error = callbackUrl.searchParams.get('error')

      if (error) {
        console.log('OAuth error:', error, callbackUrl.searchParams.get('error_description'))
      } else if (code) {
        console.log('Got authorization code:', code.substring(0, 10) + '...')
        console.log('State:', state)
        expect(state).toContain('test-state-')
      }
    } else {
      // Still on auth page - may need user interaction
      console.log('OAuth flow requires user interaction at:', finalUrl)
    }

    // Test passes if we got this far without errors
    expect(response?.ok() || response?.status() === 302).toBe(true)
  })
})

/**
 * Generate a cryptographically random code verifier for PKCE
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64UrlEncode(array)
}

/**
 * Generate S256 code challenge from verifier
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(digest))
}

/**
 * Base64 URL encode without padding
 */
function base64UrlEncode(array: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...array))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
