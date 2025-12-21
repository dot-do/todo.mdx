/**
 * Auth module exports
 */

export { authMiddleware, optionalAuthMiddleware, type AuthContext, type AuthType } from './middleware'
export { validateOAuthToken, decodeOAuthToken, type OAuthSession } from './jwt'
export { validateApiKey, getWidgetToken, type ApiKeySession } from './workos'
export {
  storeSecret,
  getSecret,
  deleteSecret,
  upsertSecret,
  storeClaudeToken,
  getClaudeToken,
  storeGitHubToken,
  getGitHubToken,
  deleteUserTokens,
  WorkflowTokenProvider,
  type VaultSecret,
  type VaultEnv,
} from './vault'
export {
  getAuthorizationUrl,
  exchangeCodeForUser,
  getUserProfile,
  type WorkOSUser,
  type WorkOSAuthEnv,
} from './authkit'

// Unified session management
export {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  createSession,
  createSessionToken,
  parseSessionToken,
  getSessionFromRequest,
  buildSetSessionCookie,
  buildClearSessionCookie,
  type SessionData,
} from './session'
