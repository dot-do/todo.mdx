/**
 * Shared Authentication Helpers
 *
 * Consolidated authentication utilities for tests.
 * All auth-related functions should be imported from here.
 */

/**
 * Get authentication token (reads env at call time for dotenv support)
 */
export function getAuthToken(): string | null {
  return process.env.TEST_API_KEY || null
}

/**
 * Get the worker base URL
 */
export function getWorkerBaseUrl(): string {
  return process.env.WORKER_BASE_URL || 'https://todo.mdx.do'
}

/**
 * Get the GitHub webhook secret
 */
export function getWebhookSecret(): string {
  return process.env.GITHUB_WEBHOOK_SECRET || 'test-secret'
}

/**
 * Generate GitHub webhook signature for testing
 */
export async function generateGitHubSignature(body: string, secret?: string): Promise<string> {
  const webhookSecret = secret ?? getWebhookSecret()
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const hex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return `sha256=${hex}`
}

/**
 * Check if worker credentials are available
 */
export function hasWorkerCredentials(): boolean {
  return !!process.env.TEST_API_KEY
}

/**
 * Check if MCP credentials are available
 */
export function hasMcpCredentials(): boolean {
  return !!process.env.TEST_API_KEY
}
