/**
 * WorkOS API Key Verification
 * Validates API keys created via WorkOS dashboard widget
 */

export interface ApiKeySession {
  userId: string
  organizationId?: string
  keyName: string
}

export async function validateApiKey(
  apiKey: string,
  env: { WORKOS_API_KEY: string }
): Promise<ApiKeySession> {
  // Use WorkOS API directly (the SDK may not have all methods)
  // https://workos.com/docs/api-keys/verify
  const response = await fetch('https://api.workos.com/api_keys/verify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.WORKOS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: apiKey }),
  })

  if (!response.ok) {
    throw new Error('Invalid API key')
  }

  const result = await response.json() as {
    valid: boolean
    user_id?: string
    organization_id?: string
    name?: string
  }

  if (!result.valid || !result.user_id) {
    throw new Error('Invalid API key')
  }

  return {
    userId: result.user_id,
    organizationId: result.organization_id,
    keyName: result.name || 'unnamed',
  }
}

export async function getWidgetToken(
  userId: string,
  organizationId: string | undefined,
  env: { WORKOS_API_KEY: string }
): Promise<string> {
  // Use WorkOS API directly
  // https://workos.com/docs/widgets/api-keys
  const response = await fetch('https://api.workos.com/widgets/token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.WORKOS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: userId,
      organization_id: organizationId,
      scopes: ['widgets:api-keys:manage'],
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to get widget token')
  }

  const result = await response.json() as { token: string }
  return result.token
}
