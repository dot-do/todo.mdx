/**
 * Authentication utilities for agents.mdx
 *
 * Provides token management and authentication helpers
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { AuthenticationError, ValidationError } from '@todo.mdx/core'

// ============================================================================
// Types
// ============================================================================

export interface AuthTokens {
  claudeJwt: string
  githubToken: string
  workosToken: string
  expiresAt?: string
}

export interface TokenValidationResult {
  valid: boolean
  expired: boolean
  expiresAt?: Date
  error?: string
}

// ============================================================================
// Constants
// ============================================================================

export const CONFIG_DIR = join(homedir(), '.agents.mdx')
export const TOKENS_FILE = join(CONFIG_DIR, 'tokens.json')

// ============================================================================
// Token Management
// ============================================================================

/**
 * Load authentication tokens from local storage
 */
export async function loadTokens(): Promise<AuthTokens | null> {
  try {
    const data = await readFile(TOKENS_FILE, 'utf-8')
    return JSON.parse(data) as AuthTokens
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw err
  }
}

/**
 * Validate tokens and check expiration
 */
export function validateTokens(tokens: AuthTokens): TokenValidationResult {
  // Check all required tokens are present
  if (!tokens.claudeJwt || !tokens.githubToken || !tokens.workosToken) {
    return {
      valid: false,
      expired: false,
      error: 'Missing required tokens',
    }
  }

  // Check expiration if present
  if (tokens.expiresAt) {
    const expiresAt = new Date(tokens.expiresAt)
    const now = new Date()
    const expired = expiresAt < now

    return {
      valid: !expired,
      expired,
      expiresAt,
      error: expired ? 'Tokens have expired' : undefined,
    }
  }

  // No expiration date - assume valid
  return {
    valid: true,
    expired: false,
  }
}

/**
 * Get valid authentication tokens or throw
 */
export async function getValidTokens(): Promise<AuthTokens> {
  const tokens = await loadTokens()

  if (!tokens) {
    throw new AuthenticationError('Not authenticated', {
      context: {
        message: 'Run `agents.mdx auth` to authenticate',
      },
    })
  }

  const validation = validateTokens(tokens)

  if (!validation.valid) {
    throw new ValidationError(validation.error || 'Invalid tokens', {
      field: 'authTokens',
      context: {
        expired: validation.expired,
        expiresAt: validation.expiresAt?.toISOString(),
      },
    })
  }

  return tokens
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const tokens = await loadTokens()
    if (!tokens) return false

    const validation = validateTokens(tokens)
    return validation.valid
  } catch {
    return false
  }
}
