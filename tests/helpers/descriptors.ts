/**
 * Conditional Describe Helpers
 *
 * Factory functions for creating vitest `describe` blocks that skip
 * based on credential availability and environment configuration.
 *
 * This eliminates duplicated conditional describe patterns across test files.
 */

import { describe } from 'vitest'
import { hasGitHubCredentials } from './github'
import { hasWorkerCredentials } from './auth'
import { hasSandboxCredentials } from './stdio'

// Re-export credential check functions for convenience
export { hasGitHubCredentials } from './github'
export { hasWorkerCredentials } from './auth'
export { hasSandboxCredentials } from './stdio'

/**
 * Options for creating a conditional describe
 */
export interface ConditionalDescribeOptions {
  /** Function that returns true if the describe should run */
  condition: () => boolean
  /** Optional message to log when skipping */
  skipMessage?: string
}

/**
 * Create a conditional describe that skips if condition returns false.
 *
 * @example
 * const describeWithAuth = createConditionalDescribe({
 *   condition: () => !!process.env.API_KEY,
 *   skipMessage: 'Skipping - API_KEY not configured'
 * })
 *
 * describeWithAuth('authenticated tests', () => {
 *   // tests that require API_KEY
 * })
 */
export function createConditionalDescribe(options: ConditionalDescribeOptions) {
  const { condition, skipMessage } = options
  const shouldRun = condition()

  if (!shouldRun && skipMessage) {
    // Log skip message once when module loads
    console.log(skipMessage)
  }

  return shouldRun ? describe : describe.skip
}

/**
 * Check if webhook tests should be skipped.
 * Skips webhook tests when:
 * - Running against production (todo.mdx.do) without GITHUB_WEBHOOK_SECRET
 */
export function shouldSkipWebhookTests(): boolean {
  const workerBaseUrl = process.env.WORKER_BASE_URL || 'https://todo.mdx.do'
  const isProduction = workerBaseUrl.includes('todo.mdx.do')
  const hasWebhookSecret = !!process.env.GITHUB_WEBHOOK_SECRET

  return isProduction && !hasWebhookSecret
}

/**
 * Check if sandbox tests should be skipped.
 * Skips sandbox tests when:
 * - Running against production without SANDBOX_TESTS_ENABLED
 */
export function shouldSkipSandboxTests(): boolean {
  const workerBaseUrl = process.env.WORKER_BASE_URL || 'https://todo.mdx.do'
  const isProduction = workerBaseUrl.includes('todo.mdx.do')

  return isProduction && !process.env.SANDBOX_TESTS_ENABLED
}

// ============================================================================
// Pre-built conditional describes for common patterns
// ============================================================================

/**
 * Skip tests if GitHub credentials are not configured.
 *
 * Required env vars: GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_INSTALLATION_ID
 */
export const describeWithGitHub = createConditionalDescribe({
  condition: hasGitHubCredentials,
  skipMessage: 'Skipping GitHub tests - credentials not configured (GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_INSTALLATION_ID)',
})

/**
 * Skip tests if worker credentials are not configured OR if running against production with test credentials.
 *
 * Required env vars: TEST_API_KEY
 * For production: Needs real API key (not 'test' or 'test-secret')
 */
export const describeWithWorker = createConditionalDescribe({
  condition: () => {
    const hasCredentials = hasWorkerCredentials()
    const apiKey = process.env.TEST_API_KEY
    const hasRealKey = apiKey && apiKey !== 'test' && apiKey !== 'test-secret'
    const workerBaseUrl = process.env.WORKER_BASE_URL || 'https://todo.mdx.do'
    const isProduction = workerBaseUrl.includes('todo.mdx.do')

    // Skip if no credentials, or if running against production without real API key
    return hasCredentials && (!isProduction || hasRealKey)
  },
  skipMessage: 'Skipping worker tests - TEST_API_KEY not configured or test credentials provided for production',
})

/**
 * Skip tests if both GitHub AND worker credentials are not configured.
 * Also skips if running against production with test credentials.
 *
 * Useful for bidirectional sync tests that need both systems.
 */
export const describeWithBoth = createConditionalDescribe({
  condition: () => {
    const hasGitHub = hasGitHubCredentials()
    const hasWorker = hasWorkerCredentials()
    const apiKey = process.env.TEST_API_KEY
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET
    const hasRealKey = apiKey && apiKey !== 'test' && apiKey !== 'test-secret'
    const hasRealSecret = webhookSecret && webhookSecret !== 'test' && webhookSecret !== 'test-secret'
    const workerBaseUrl = process.env.WORKER_BASE_URL || 'https://todo.mdx.do'
    const isProduction = workerBaseUrl.includes('todo.mdx.do')

    // Skip if missing credentials, or if running against production without real credentials
    return hasGitHub && hasWorker && (!isProduction || (hasRealKey && hasRealSecret))
  },
  skipMessage: 'Skipping combined tests - both GitHub and worker credentials required, or test credentials provided for production',
})

/**
 * Skip tests if sandbox credentials are not configured OR if sandbox tests should be skipped.
 *
 * Required env vars: TEST_API_KEY (same as worker)
 * Skips against production unless SANDBOX_TESTS_ENABLED is set.
 */
export const describeWithSandbox = createConditionalDescribe({
  condition: () => hasSandboxCredentials() && !shouldSkipSandboxTests(),
  skipMessage: 'Skipping sandbox tests - credentials not configured or sandbox tests disabled in production',
})

/**
 * Skip tests if Anthropic API key is not configured.
 *
 * Required env vars: ANTHROPIC_API_KEY
 */
export const describeWithAnthropic = createConditionalDescribe({
  condition: () => !!process.env.ANTHROPIC_API_KEY,
  skipMessage: 'Skipping Anthropic tests - ANTHROPIC_API_KEY not configured',
})

/**
 * Skip tests if MCP credentials are not configured.
 * Uses TEST_API_KEY or MCP_API_TOKEN.
 *
 * Optional: MCP_API_TOKEN for production MCP server
 */
export const describeWithMcp = createConditionalDescribe({
  condition: () => !!(process.env.TEST_API_KEY || process.env.MCP_API_TOKEN),
  skipMessage: 'Skipping MCP tests - TEST_API_KEY or MCP_API_TOKEN not configured',
})

/**
 * Skip webhook tests specifically (requires GITHUB_WEBHOOK_SECRET for production).
 *
 * Required env vars: TEST_API_KEY, GITHUB_WEBHOOK_SECRET (for production)
 */
export const describeWithWebhookSecret = createConditionalDescribe({
  condition: () => {
    const hasCredentials = hasWorkerCredentials()
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET
    const hasRealSecret = webhookSecret && webhookSecret !== 'test' && webhookSecret !== 'test-secret'
    const workerBaseUrl = process.env.WORKER_BASE_URL || 'https://todo.mdx.do'
    const isProduction = workerBaseUrl.includes('todo.mdx.do')

    // Skip if no credentials, or if running against production without real secret
    return hasCredentials && !!webhookSecret && (!isProduction || hasRealSecret)
  },
  skipMessage: 'Skipping webhook tests - GITHUB_WEBHOOK_SECRET not configured or test secret provided for production',
})

/**
 * Skip tests requiring full autonomous workflow credentials.
 *
 * Required env vars: TEST_API_KEY, GITHUB_INSTALLATION_ID, ANTHROPIC_API_KEY
 */
export const describeWithAutonomous = createConditionalDescribe({
  condition: () => {
    const hasApiKey = !!process.env.TEST_API_KEY
    const hasInstallation = !!process.env.GITHUB_INSTALLATION_ID
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY
    return hasApiKey && hasInstallation && hasAnthropic
  },
  skipMessage: 'Skipping autonomous tests - TEST_API_KEY, GITHUB_INSTALLATION_ID, and ANTHROPIC_API_KEY required',
})

/**
 * Check if Slack credentials are available.
 */
export function hasSlackCredentials(): boolean {
  return !!(
    process.env.SLACK_BOT_TOKEN &&
    process.env.SLACK_TEST_CHANNEL &&
    process.env.WORKER_ACCESS_TOKEN
  )
}

/**
 * Check if Slack webhook URL is available.
 */
export function hasSlackWebhook(): boolean {
  return !!process.env.SLACK_WEBHOOK_URL
}

/**
 * Skip tests if Slack bot credentials are not configured.
 *
 * Required env vars: SLACK_BOT_TOKEN, SLACK_TEST_CHANNEL, WORKER_ACCESS_TOKEN
 */
export const describeWithSlack = createConditionalDescribe({
  condition: hasSlackCredentials,
  skipMessage: 'Skipping Slack tests - SLACK_BOT_TOKEN, SLACK_TEST_CHANNEL, and WORKER_ACCESS_TOKEN required',
})

/**
 * Skip tests if Slack webhook URL is not configured.
 *
 * Required env vars: SLACK_WEBHOOK_URL
 */
export const describeWithSlackWebhook = createConditionalDescribe({
  condition: hasSlackWebhook,
  skipMessage: 'Skipping Slack webhook tests - SLACK_WEBHOOK_URL required',
})
