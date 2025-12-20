import { describe, it, expect } from 'vitest'
import { parse as parseUrl } from 'node:url'

/**
 * Tests for CLI OAuth flow
 */

interface OAuthCallbackParams {
  claude_jwt?: string
  github_token?: string
  workos_token?: string
  expires_at?: string
  error?: string
  error_description?: string
}

function parseCallbackParams(url: string): OAuthCallbackParams {
  const parsed = parseUrl(url, true)
  return {
    claude_jwt: parsed.query.claude_jwt as string | undefined,
    github_token: parsed.query.github_token as string | undefined,
    workos_token: parsed.query.workos_token as string | undefined,
    expires_at: parsed.query.expires_at as string | undefined,
    error: parsed.query.error as string | undefined,
    error_description: parsed.query.error_description as string | undefined,
  }
}

describe('OAuth Callback Parsing', () => {
  it('should parse successful OAuth callback with all tokens', () => {
    const url = '/callback?claude_jwt=eyJ123&github_token=ghp_123&workos_token=wos_123&expires_at=2025-12-20T12:00:00Z'
    const params = parseCallbackParams(url)

    expect(params.claude_jwt).toBe('eyJ123')
    expect(params.github_token).toBe('ghp_123')
    expect(params.workos_token).toBe('wos_123')
    expect(params.expires_at).toBe('2025-12-20T12:00:00Z')
    expect(params.error).toBeUndefined()
  })

  it('should parse OAuth error response', () => {
    const url = '/callback?error=access_denied&error_description=User+cancelled+authentication'
    const params = parseCallbackParams(url)

    expect(params.error).toBe('access_denied')
    expect(params.error_description).toBe('User cancelled authentication')
    expect(params.claude_jwt).toBeUndefined()
    expect(params.github_token).toBeUndefined()
    expect(params.workos_token).toBeUndefined()
  })

  it('should handle missing optional fields', () => {
    const url = '/callback?claude_jwt=eyJ123&github_token=ghp_123&workos_token=wos_123'
    const params = parseCallbackParams(url)

    expect(params.claude_jwt).toBe('eyJ123')
    expect(params.github_token).toBe('ghp_123')
    expect(params.workos_token).toBe('wos_123')
    expect(params.expires_at).toBeUndefined()
  })

  it('should handle partial token response', () => {
    const url = '/callback?claude_jwt=eyJ123'
    const params = parseCallbackParams(url)

    expect(params.claude_jwt).toBe('eyJ123')
    expect(params.github_token).toBeUndefined()
    expect(params.workos_token).toBeUndefined()
  })

  it('should handle empty callback', () => {
    const url = '/callback'
    const params = parseCallbackParams(url)

    expect(params.claude_jwt).toBeUndefined()
    expect(params.github_token).toBeUndefined()
    expect(params.workos_token).toBeUndefined()
    expect(params.error).toBeUndefined()
  })

  it('should handle URL-encoded error descriptions', () => {
    const url = '/callback?error=server_error&error_description=An+unexpected+error+occurred'
    const params = parseCallbackParams(url)

    expect(params.error).toBe('server_error')
    expect(params.error_description).toBe('An unexpected error occurred')
  })
})

describe('Token Validation', () => {
  it('should identify complete token set', () => {
    const params: OAuthCallbackParams = {
      claude_jwt: 'eyJ123',
      github_token: 'ghp_123',
      workos_token: 'wos_123',
    }

    const hasAllTokens = !!(params.claude_jwt && params.github_token && params.workos_token)
    expect(hasAllTokens).toBe(true)
  })

  it('should identify incomplete token set', () => {
    const params: OAuthCallbackParams = {
      claude_jwt: 'eyJ123',
      github_token: 'ghp_123',
    }

    const hasAllTokens = !!(params.claude_jwt && params.github_token && params.workos_token)
    expect(hasAllTokens).toBe(false)
  })

  it('should identify error response', () => {
    const params: OAuthCallbackParams = {
      error: 'access_denied',
    }

    const hasError = !!params.error
    expect(hasError).toBe(true)
  })
})

describe('OAuth URL Generation', () => {
  it('should generate correct OAuth authorization URL', () => {
    const clientId = 'agents-mdx'
    const redirectUri = 'http://localhost:3000/callback'
    const scopes = ['claude:code', 'github:repo', 'workos:vault']

    const authUrl = new URL('https://oauth.do/authorize')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', scopes.join(' '))
    authUrl.searchParams.set('response_type', 'token')

    expect(authUrl.toString()).toBe(
      'https://oauth.do/authorize?client_id=agents-mdx&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback&scope=claude%3Acode+github%3Arepo+workos%3Avault&response_type=token'
    )
  })

  it('should properly encode redirect URI', () => {
    const redirectUri = 'http://localhost:3000/callback?state=abc123'

    const authUrl = new URL('https://oauth.do/authorize')
    authUrl.searchParams.set('redirect_uri', redirectUri)

    const encoded = authUrl.searchParams.get('redirect_uri')
    expect(encoded).toBe('http://localhost:3000/callback?state=abc123')
  })
})
