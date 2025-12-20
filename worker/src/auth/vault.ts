/**
 * WorkOS Vault Integration
 *
 * Securely store and retrieve secrets like Claude JWT and GitHub tokens.
 * Each secret is encrypted with a unique key and isolated by organization context.
 *
 * @see https://workos.com/docs/vault
 */

export interface VaultSecret {
  id: string
  key: string
  value: string
  context?: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface VaultEnv {
  WORKOS_API_KEY: string
}

const WORKOS_API_BASE = 'https://api.workos.com'

/**
 * Store a secret in WorkOS Vault
 *
 * @param key - Unique key for the secret (e.g., "github_token:user_123")
 * @param value - The secret value to encrypt and store
 * @param context - Optional context for cryptographic isolation (e.g., { organizationId: "org_xxx" })
 */
export async function storeSecret(
  env: VaultEnv,
  key: string,
  value: string,
  context?: Record<string, string>
): Promise<VaultSecret> {
  const response = await fetch(`${WORKOS_API_BASE}/vault/secrets`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.WORKOS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key,
      value,
      context,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to store secret: ${error}`)
  }

  return response.json()
}

/**
 * Retrieve a secret from WorkOS Vault
 *
 * @param key - The key of the secret to retrieve
 * @param context - Optional context used when storing (must match)
 */
export async function getSecret(
  env: VaultEnv,
  key: string,
  context?: Record<string, string>
): Promise<VaultSecret | null> {
  const params = new URLSearchParams({ key })
  if (context) {
    params.set('context', JSON.stringify(context))
  }

  const response = await fetch(`${WORKOS_API_BASE}/vault/secrets?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${env.WORKOS_API_KEY}`,
    },
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get secret: ${error}`)
  }

  return response.json()
}

/**
 * Delete a secret from WorkOS Vault
 *
 * @param key - The key of the secret to delete
 */
export async function deleteSecret(
  env: VaultEnv,
  key: string
): Promise<void> {
  const response = await fetch(`${WORKOS_API_BASE}/vault/secrets/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${env.WORKOS_API_KEY}`,
    },
  })

  if (!response.ok && response.status !== 404) {
    const error = await response.text()
    throw new Error(`Failed to delete secret: ${error}`)
  }
}

/**
 * Update or create a secret (upsert)
 */
export async function upsertSecret(
  env: VaultEnv,
  key: string,
  value: string,
  context?: Record<string, string>
): Promise<VaultSecret> {
  // Try to delete existing first (ignore if not found)
  await deleteSecret(env, key).catch(() => {})

  // Create new secret
  return storeSecret(env, key, value, context)
}

// ============================================
// Typed helpers for specific token types
// ============================================

/**
 * Store a Claude Code JWT for a user
 */
export async function storeClaudeToken(
  env: VaultEnv,
  userId: string,
  token: string,
  organizationId?: string
): Promise<VaultSecret> {
  return upsertSecret(
    env,
    `claude_jwt:${userId}`,
    token,
    organizationId ? { organizationId } : undefined
  )
}

/**
 * Get a Claude Code JWT for a user
 */
export async function getClaudeToken(
  env: VaultEnv,
  userId: string,
  organizationId?: string
): Promise<string | null> {
  const secret = await getSecret(
    env,
    `claude_jwt:${userId}`,
    organizationId ? { organizationId } : undefined
  )
  return secret?.value || null
}

/**
 * Store a GitHub token for a user or installation
 */
export async function storeGitHubToken(
  env: VaultEnv,
  identifier: string,
  token: string,
  type: 'user' | 'installation' = 'user',
  organizationId?: string
): Promise<VaultSecret> {
  return upsertSecret(
    env,
    `github_${type}_token:${identifier}`,
    token,
    organizationId ? { organizationId } : undefined
  )
}

/**
 * Get a GitHub token for a user or installation
 */
export async function getGitHubToken(
  env: VaultEnv,
  identifier: string,
  type: 'user' | 'installation' = 'user',
  organizationId?: string
): Promise<string | null> {
  const secret = await getSecret(
    env,
    `github_${type}_token:${identifier}`,
    organizationId ? { organizationId } : undefined
  )
  return secret?.value || null
}

/**
 * Delete all tokens for a user (for cleanup on logout/revocation)
 */
export async function deleteUserTokens(
  env: VaultEnv,
  userId: string
): Promise<void> {
  await Promise.all([
    deleteSecret(env, `claude_jwt:${userId}`),
    deleteSecret(env, `github_user_token:${userId}`),
  ])
}

// ============================================
// Workflow Token Provider
// ============================================

/**
 * Token provider for authenticated workflow execution
 *
 * Fetches tokens from Vault at runtime for secure workflow operations.
 */
export class WorkflowTokenProvider {
  private env: VaultEnv
  private userId: string
  private organizationId?: string

  // Token cache to avoid repeated vault calls
  private cache: Map<string, { value: string; expiresAt: number }> = new Map()
  private cacheMs = 5 * 60 * 1000 // 5 minute cache

  constructor(
    env: VaultEnv,
    userId: string,
    organizationId?: string
  ) {
    this.env = env
    this.userId = userId
    this.organizationId = organizationId
  }

  /**
   * Get Claude Code JWT for this workflow
   */
  async getClaudeJWT(): Promise<string | null> {
    const cacheKey = 'claude_jwt'
    const cached = this.cache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value
    }

    const token = await getClaudeToken(this.env, this.userId, this.organizationId)
    if (token) {
      this.cache.set(cacheKey, { value: token, expiresAt: Date.now() + this.cacheMs })
    }
    return token
  }

  /**
   * Get GitHub token for this workflow
   */
  async getGitHubToken(): Promise<string | null> {
    const cacheKey = 'github_token'
    const cached = this.cache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value
    }

    const token = await getGitHubToken(this.env, this.userId, 'user', this.organizationId)
    if (token) {
      this.cache.set(cacheKey, { value: token, expiresAt: Date.now() + this.cacheMs })
    }
    return token
  }

  /**
   * Clear the token cache
   */
  clearCache(): void {
    this.cache.clear()
  }
}
