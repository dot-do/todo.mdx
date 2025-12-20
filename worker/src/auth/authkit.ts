/**
 * WorkOS AuthKit Integration
 * Handles OAuth 2.1 authorization flow with WorkOS AuthKit
 */

export interface WorkOSUser {
  id: string
  email: string
  firstName?: string
  lastName?: string
  emailVerified: boolean
  organizationId?: string
}

export interface WorkOSAuthEnv {
  WORKOS_API_KEY: string
  WORKOS_CLIENT_ID: string
  WORKOS_CLIENT_SECRET: string
}

/**
 * Generate WorkOS AuthKit authorization URL
 *
 * @param env - WorkOS environment variables
 * @param redirectUri - Callback URL where WorkOS will redirect after auth
 * @param state - OAuth state parameter for CSRF protection
 */
export function getAuthorizationUrl(
  env: WorkOSAuthEnv,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: env.WORKOS_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    provider: 'authkit',
  })

  return `https://api.workos.com/user_management/authorize?${params.toString()}`
}

/**
 * Exchange WorkOS authorization code for user information
 *
 * @param env - WorkOS environment variables
 * @param code - Authorization code from WorkOS callback
 */
export async function exchangeCodeForUser(
  env: WorkOSAuthEnv,
  code: string
): Promise<WorkOSUser> {
  // Exchange code for access token
  const tokenResponse = await fetch('https://api.workos.com/user_management/authenticate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.WORKOS_API_KEY}`,
    },
    body: JSON.stringify({
      client_id: env.WORKOS_CLIENT_ID,
      client_secret: env.WORKOS_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
    }),
  })

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text()
    throw new Error(`Failed to exchange code for token: ${error}`)
  }

  const authResult = await tokenResponse.json() as {
    user: {
      id: string
      email: string
      first_name?: string
      last_name?: string
      email_verified: boolean
    }
    organization_id?: string
    access_token: string
  }

  return {
    id: authResult.user.id,
    email: authResult.user.email,
    firstName: authResult.user.first_name,
    lastName: authResult.user.last_name,
    emailVerified: authResult.user.email_verified,
    organizationId: authResult.organization_id,
  }
}

/**
 * Get user profile from WorkOS
 *
 * @param env - WorkOS environment variables
 * @param userId - WorkOS user ID
 */
export async function getUserProfile(
  env: WorkOSAuthEnv,
  userId: string
): Promise<WorkOSUser | null> {
  const response = await fetch(`https://api.workos.com/user_management/users/${userId}`, {
    headers: {
      'Authorization': `Bearer ${env.WORKOS_API_KEY}`,
    },
  })

  if (!response.ok) {
    if (response.status === 404) {
      return null
    }
    const error = await response.text()
    throw new Error(`Failed to get user profile: ${error}`)
  }

  const user = await response.json() as {
    id: string
    email: string
    first_name?: string
    last_name?: string
    email_verified: boolean
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    emailVerified: user.email_verified,
  }
}
