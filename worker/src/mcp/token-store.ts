/**
 * MCP OAuth Token Store - D1 Database Persistence
 *
 * Manages authorization codes and access tokens for MCP OAuth 2.1 flow.
 * Replaces in-memory Maps with persistent D1 storage.
 */

export interface AuthCodeData {
  userId: string
  clientId: string
  redirectUri: string
  codeChallenge?: string
  codeChallengeMethod?: string
  scope: string
  expiresAt: number
}

export interface TokenData {
  userId: string
  clientId: string
  scope: string
  expiresAt: number
}

/**
 * Store an authorization code in D1
 */
export async function storeAuthCode(
  db: D1Database,
  code: string,
  data: AuthCodeData
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO mcp_auth_codes (
        code, user_id, client_id, redirect_uri,
        code_challenge, code_challenge_method, scope, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      code,
      data.userId,
      data.clientId,
      data.redirectUri,
      data.codeChallenge ?? null,
      data.codeChallengeMethod ?? null,
      data.scope,
      data.expiresAt
    )
    .run()
}

/**
 * Get an authorization code from D1
 */
export async function getAuthCode(
  db: D1Database,
  code: string
): Promise<AuthCodeData | null> {
  const result = await db
    .prepare(
      `SELECT user_id, client_id, redirect_uri, code_challenge,
              code_challenge_method, scope, expires_at
       FROM mcp_auth_codes
       WHERE code = ?`
    )
    .bind(code)
    .first<{
      user_id: string
      client_id: string
      redirect_uri: string
      code_challenge: string | null
      code_challenge_method: string | null
      scope: string
      expires_at: number
    }>()

  if (!result) {
    return null
  }

  return {
    userId: result.user_id,
    clientId: result.client_id,
    redirectUri: result.redirect_uri,
    codeChallenge: result.code_challenge ?? undefined,
    codeChallengeMethod: result.code_challenge_method ?? undefined,
    scope: result.scope,
    expiresAt: result.expires_at,
  }
}

/**
 * Delete an authorization code from D1 (used after token exchange)
 */
export async function deleteAuthCode(
  db: D1Database,
  code: string
): Promise<void> {
  await db
    .prepare(`DELETE FROM mcp_auth_codes WHERE code = ?`)
    .bind(code)
    .run()
}

/**
 * Store an access token in D1
 */
export async function storeAccessToken(
  db: D1Database,
  token: string,
  data: TokenData
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO mcp_access_tokens (
        token, user_id, client_id, scope, expires_at
      ) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(
      token,
      data.userId,
      data.clientId,
      data.scope,
      data.expiresAt
    )
    .run()
}

/**
 * Get an access token from D1
 */
export async function getAccessToken(
  db: D1Database,
  token: string
): Promise<TokenData | null> {
  const result = await db
    .prepare(
      `SELECT user_id, client_id, scope, expires_at
       FROM mcp_access_tokens
       WHERE token = ?`
    )
    .bind(token)
    .first<{
      user_id: string
      client_id: string
      scope: string
      expires_at: number
    }>()

  if (!result) {
    return null
  }

  return {
    userId: result.user_id,
    clientId: result.client_id,
    scope: result.scope,
    expiresAt: result.expires_at,
  }
}

/**
 * Delete an access token from D1 (used for revocation)
 */
export async function deleteAccessToken(
  db: D1Database,
  token: string
): Promise<void> {
  await db
    .prepare(`DELETE FROM mcp_access_tokens WHERE token = ?`)
    .bind(token)
    .run()
}

/**
 * Clean up expired authorization codes
 */
export async function cleanupExpiredAuthCodes(db: D1Database): Promise<number> {
  const now = Date.now()
  const result = await db
    .prepare(`DELETE FROM mcp_auth_codes WHERE expires_at < ?`)
    .bind(now)
    .run()

  return result.meta.changes || 0
}

/**
 * Clean up expired access tokens
 */
export async function cleanupExpiredAccessTokens(db: D1Database): Promise<number> {
  const now = Date.now()
  const result = await db
    .prepare(`DELETE FROM mcp_access_tokens WHERE expires_at < ?`)
    .bind(now)
    .run()

  return result.meta.changes || 0
}

/**
 * Clean up expired OAuth state
 */
export async function cleanupExpiredOAuthState(db: D1Database): Promise<number> {
  const now = Date.now()
  const result = await db
    .prepare(`DELETE FROM mcp_oauth_state WHERE expires_at < ?`)
    .bind(now)
    .run()

  return result.meta.changes || 0
}

/**
 * Clean up all expired tokens (both auth codes and access tokens)
 */
export async function cleanupExpiredTokens(db: D1Database): Promise<{
  authCodes: number
  accessTokens: number
  oauthState: number
}> {
  const [authCodes, accessTokens, oauthState] = await Promise.all([
    cleanupExpiredAuthCodes(db),
    cleanupExpiredAccessTokens(db),
    cleanupExpiredOAuthState(db),
  ])

  return { authCodes, accessTokens, oauthState }
}
