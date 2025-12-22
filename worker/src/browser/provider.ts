/**
 * Browser Provider Factory
 *
 * Creates browser providers for automation sessions.
 * Supports Cloudflare Browser Rendering (free) and Browser Base (paid).
 */

import type { Env } from '../types/env'
import type {
  BrowserProvider,
  CreateSessionOptions,
  ProviderType,
} from '../types/browser'
import { CloudflareBrowserProvider } from './cloudflare'
import { BrowserbaseProvider } from './browserbase'

/**
 * Select the appropriate provider based on config and user tier
 */
export function selectProvider(
  env: Env,
  options: CreateSessionOptions,
  user?: { isPaid?: boolean }
): ProviderType {
  // Explicit override in options
  if (options.provider) {
    return options.provider
  }

  // Environment default
  if (env.BROWSER_PROVIDER) {
    return env.BROWSER_PROVIDER as ProviderType
  }

  // Default to cloudflare (free)
  return 'cloudflare'
}

/**
 * Create a browser provider instance
 */
export function createBrowserProvider(
  providerType: ProviderType,
  env: Env
): BrowserProvider {
  switch (providerType) {
    case 'cloudflare':
      return new CloudflareBrowserProvider(env)
    case 'browserbase':
      return new BrowserbaseProvider(env)
    default:
      throw new Error(`Unknown browser provider: ${providerType}`)
  }
}

/**
 * Get provider with automatic selection
 */
export function getBrowserProvider(
  env: Env,
  options: CreateSessionOptions = {},
  user?: { isPaid?: boolean }
): BrowserProvider {
  const providerType = selectProvider(env, options, user)
  return createBrowserProvider(providerType, env)
}

/**
 * Result from session creation with fallback info
 */
export interface SessionWithFallbackResult {
  session: import('../types/browser').BrowserSession
  fallback: boolean
  fallbackReason?: string
}

/**
 * Create a browser session with automatic fallback to Cloudflare on Browserbase errors.
 *
 * When Browserbase API fails (network errors, API errors), this function will:
 * 1. Log the error for monitoring
 * 2. Attempt to create a Cloudflare session instead (if BROWSER binding available)
 * 3. Return the session with fallback metadata
 *
 * If Cloudflare is not available (no BROWSER binding), the original error is thrown.
 */
export async function createSessionWithFallback(
  env: Env,
  options: CreateSessionOptions = {},
  user?: { isPaid?: boolean }
): Promise<SessionWithFallbackResult> {
  const providerType = selectProvider(env, options, user)

  // If already using cloudflare, no fallback needed
  if (providerType === 'cloudflare') {
    const provider = createBrowserProvider('cloudflare', env)
    const session = await provider.createSession(options)
    return { session, fallback: false }
  }

  // Try browserbase first
  const browserbaseProvider = createBrowserProvider('browserbase', env)
  try {
    const session = await browserbaseProvider.createSession(options)
    return { session, fallback: false }
  } catch (error) {
    const errorMessage = (error as Error).message

    // Check if Cloudflare is available for fallback
    if (!env.BROWSER) {
      // No fallback available - re-throw original error
      throw error
    }

    // Log the failure for monitoring
    console.warn(
      `[BrowserProvider] Browserbase failed, falling back to Cloudflare: ${errorMessage}`
    )

    // Fallback to Cloudflare
    const cloudflareProvider = createBrowserProvider('cloudflare', env)
    const session = await cloudflareProvider.createSession(options)

    return {
      session,
      fallback: true,
      fallbackReason: errorMessage,
    }
  }
}
