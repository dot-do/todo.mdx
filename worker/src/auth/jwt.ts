/**
 * OAuth Token Verification using jose
 * Validates JWTs from WorkOS (via oauth.do custom domain)
 *
 * WorkOS JWKS URL format: https://api.workos.com/sso/jwks/<clientId>
 * See: https://workos.com/docs/user-management/sessions
 */

import { jwtVerify, createRemoteJWKSet, decodeJwt } from 'jose'

export interface OAuthSession {
  userId: string
  email?: string
  permissions: string[]
  organizationId?: string
}

// Cache JWKS per client ID - jose handles caching internally
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function getWorkOSJWKS(clientId: string) {
  if (!jwksCache.has(clientId)) {
    // WorkOS JWKS endpoint format
    const jwksUrl = new URL(`https://api.workos.com/sso/jwks/${clientId}`)
    jwksCache.set(clientId, createRemoteJWKSet(jwksUrl))
  }
  return jwksCache.get(clientId)!
}

export async function validateOAuthToken(
  token: string,
  env: { WORKOS_CLIENT_ID?: string }
): Promise<OAuthSession> {
  const clientId = env.WORKOS_CLIENT_ID

  if (!clientId) {
    throw new Error('WORKOS_CLIENT_ID not configured')
  }

  try {
    const JWKS = getWorkOSJWKS(clientId)

    // Verify JWT signature using WorkOS JWKS
    const { payload } = await jwtVerify(token, JWKS)

    if (!payload.sub) {
      throw new Error('Missing subject in token')
    }

    return {
      userId: payload.sub,
      email: payload.email as string | undefined,
      permissions: Array.isArray(payload.permissions)
        ? payload.permissions as string[]
        : [],
      organizationId: payload.org_id as string | undefined,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Invalid OAuth token: ${message}`)
  }
}

/**
 * Decode JWT without verification (for trusted contexts only)
 * Use when token was just obtained from WorkOS API
 */
export function decodeOAuthToken(token: string): OAuthSession {
  const payload = decodeJwt(token)

  if (!payload.sub) {
    throw new Error('Missing subject in token')
  }

  return {
    userId: payload.sub,
    email: payload.email as string | undefined,
    permissions: Array.isArray(payload.permissions)
      ? payload.permissions as string[]
      : [],
    organizationId: payload.org_id as string | undefined,
  }
}
