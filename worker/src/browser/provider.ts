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
