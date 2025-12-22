/**
 * Browser Session Types
 *
 * Types for browser automation sessions supporting both
 * Cloudflare Browser Rendering (free) and Browser Base (paid)
 */

export type SessionStatus = 'pending' | 'running' | 'completed' | 'error' | 'timed_out'

export type ProviderType = 'cloudflare' | 'browserbase'

export interface BrowserSession {
  id: string                      // e.g., "browser:uuid" or "browser:org/repo#123"
  provider: ProviderType
  status: SessionStatus
  connectUrl?: string             // WebSocket/CDP URL for automation
  debuggerUrl?: string            // Embeddable viewer (Browser Base only)
  createdAt: number
  expiresAt?: number
}

export interface CreateSessionOptions {
  timeout?: number                // Default: 60 seconds
  keepAlive?: boolean             // Browser Base only, default: true
  provider?: ProviderType         // Override provider selection
  contextId?: string              // Issue ID for scoping (e.g., "org/repo#123")
  userMetadata?: Record<string, string>
  userId?: string                 // User who created the session (for ownership verification)
}

export interface BrowserProvider {
  name: string
  createSession(options: CreateSessionOptions): Promise<BrowserSession>
  getSession(sessionId: string): Promise<BrowserSession | null>
  releaseSession(sessionId: string): Promise<void>
  getRecording(sessionId: string): Promise<RrwebEvent[] | null>
}

// rrweb event type (simplified)
export interface RrwebEvent {
  type: number
  data: unknown
  timestamp: number
}

// KV storage schema
export interface StoredSession {
  sessionId: string
  provider: ProviderType
  providerSessionId: string       // Provider's internal ID
  status: SessionStatus
  debuggerUrl?: string
  connectUrl?: string
  contextId?: string              // e.g., "org/repo#123" for issue-scoped
  createdAt: number
  expiresAt: number
  userId?: string
}
