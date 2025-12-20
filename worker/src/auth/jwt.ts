/**
 * OAuth Token Verification using jose
 * Validates JWTs from oauth.do
 */

import { jwtVerify, createRemoteJWKSet, JWTPayload } from 'jose'

export interface OAuthSession {
  userId: string
  email?: string
  scopes: string[]
}

// Cache the JWKS - jose handles caching internally
const getJWKS = (issuer: string) =>
  createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))

export async function validateOAuthToken(
  token: string,
  env: { OAUTH_DO_ISSUER?: string; OAUTH_DO_CLIENT_ID?: string }
): Promise<OAuthSession> {
  const issuer = env.OAUTH_DO_ISSUER || 'https://oauth.do'
  const audience = env.OAUTH_DO_CLIENT_ID || 'todo-mdx'

  try {
    const JWKS = getJWKS(issuer)

    const { payload } = await jwtVerify(token, JWKS, {
      issuer,
      audience,
    })

    if (!payload.sub) {
      throw new Error('Missing subject in token')
    }

    return {
      userId: payload.sub,
      email: payload.email as string | undefined,
      scopes: typeof payload.scope === 'string'
        ? payload.scope.split(' ')
        : [],
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Invalid OAuth token: ${message}`)
  }
}
