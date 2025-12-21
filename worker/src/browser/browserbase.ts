/**
 * Browser Base Provider
 *
 * Premium browser automation with persistent sessions, live debug view,
 * and session recording/replay.
 *
 * @see https://docs.browserbase.com/
 */

import type { Env } from '../types/env'
import type {
  BrowserProvider,
  BrowserSession,
  CreateSessionOptions,
  RrwebEvent,
  SessionStatus,
} from '../types/browser'

const BROWSERBASE_API = 'https://api.browserbase.com/v1'

interface BrowserbaseSession {
  id: string
  status: string
  debuggerFullscreenUrl?: string
  connectUrl?: string
}

export class BrowserbaseProvider implements BrowserProvider {
  readonly name = 'browserbase'
  private env: Env
  private apiKey: string
  private projectId: string

  constructor(env: Env) {
    this.env = env
    this.apiKey = env.BROWSER_BASE_API_KEY || ''
    this.projectId = env.BROWSER_BASE_PROJECT_ID || ''

    if (!this.apiKey || !this.projectId) {
      console.warn('[BrowserbaseProvider] Missing API key or project ID - API calls will fail')
    }
  }

  private get headers(): Record<string, string> {
    return {
      'X-BB-API-Key': this.apiKey,
      'Content-Type': 'application/json',
    }
  }

  async createSession(options: CreateSessionOptions): Promise<BrowserSession> {
    const sessionId = options.contextId
      ? `browser:${options.contextId}`
      : `browser:${crypto.randomUUID()}`

    const now = Date.now()
    const timeout = options.timeout ?? 60000

    try {
      const response = await fetch(`${BROWSERBASE_API}/sessions`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          projectId: this.projectId,
          keepAlive: options.keepAlive ?? true,
          timeout: Math.floor(timeout / 1000), // Convert to seconds
          metadata: {
            ...options.userMetadata,
            contextId: options.contextId,
          },
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Browserbase API error: ${response.status} - ${error}`)
      }

      const bbSession: BrowserbaseSession = await response.json()

      // Get debug URLs
      const debugResponse = await fetch(`${BROWSERBASE_API}/sessions/${bbSession.id}/debug`, {
        headers: this.headers,
      })

      let debuggerUrl: string | undefined
      let connectUrl: string | undefined

      if (debugResponse.ok) {
        const debugInfo = await debugResponse.json() as {
          debuggerFullscreenUrl?: string
          wsUrl?: string
        }
        debuggerUrl = debugInfo.debuggerFullscreenUrl
        connectUrl = debugInfo.wsUrl
      }

      const session: BrowserSession = {
        id: sessionId,
        provider: 'browserbase',
        status: this.mapStatus(bbSession.status),
        connectUrl,
        debuggerUrl,
        createdAt: now,
        expiresAt: now + timeout,
      }

      // Store mapping in KV for later retrieval
      await this.storeSessionMapping(sessionId, bbSession.id, session)

      return session
    } catch (error) {
      console.error('[BrowserbaseProvider] Failed to create session:', error)
      throw error
    }
  }

  async getSession(sessionId: string): Promise<BrowserSession | null> {
    try {
      // Get mapping from KV
      const stored = await this.getSessionMapping(sessionId)
      if (!stored) return null

      // Fetch current status from Browserbase
      const response = await fetch(`${BROWSERBASE_API}/sessions/${stored.providerSessionId}`, {
        headers: this.headers,
      })

      if (!response.ok) {
        if (response.status === 404) return null
        throw new Error(`Browserbase API error: ${response.status}`)
      }

      const bbSession: BrowserbaseSession = await response.json()

      return {
        id: sessionId,
        provider: 'browserbase',
        status: this.mapStatus(bbSession.status),
        connectUrl: stored.connectUrl,
        debuggerUrl: stored.debuggerUrl,
        createdAt: stored.createdAt,
        expiresAt: stored.expiresAt,
      }
    } catch (error) {
      console.error('[BrowserbaseProvider] Failed to get session:', error)
      return null
    }
  }

  async releaseSession(sessionId: string): Promise<void> {
    try {
      const stored = await this.getSessionMapping(sessionId)
      if (!stored) return

      // Close the Browserbase session
      await fetch(`${BROWSERBASE_API}/sessions/${stored.providerSessionId}`, {
        method: 'DELETE',
        headers: this.headers,
      })

      // Update KV status
      stored.status = 'completed'
      await this.storeSessionMapping(sessionId, stored.providerSessionId, stored as any)
    } catch (error) {
      console.error('[BrowserbaseProvider] Failed to release session:', error)
    }
  }

  async getRecording(sessionId: string): Promise<RrwebEvent[] | null> {
    try {
      const stored = await this.getSessionMapping(sessionId)
      if (!stored) return null

      const response = await fetch(
        `${BROWSERBASE_API}/sessions/${stored.providerSessionId}/recording`,
        { headers: this.headers }
      )

      if (!response.ok) {
        if (response.status === 404) return null
        throw new Error(`Browserbase API error: ${response.status}`)
      }

      const recording = await response.json() as { events?: RrwebEvent[] }
      return recording.events || []
    } catch (error) {
      console.error('[BrowserbaseProvider] Failed to get recording:', error)
      return null
    }
  }

  private mapStatus(bbStatus: string): SessionStatus {
    switch (bbStatus) {
      case 'CREATED':
      case 'PENDING':
        return 'pending'
      case 'RUNNING':
        return 'running'
      case 'COMPLETED':
        return 'completed'
      case 'ERROR':
        return 'error'
      case 'TIMED_OUT':
        return 'timed_out'
      default:
        return 'running'
    }
  }

  private async storeSessionMapping(
    sessionId: string,
    providerSessionId: string,
    session: BrowserSession
  ): Promise<void> {
    if (!this.env.OAUTH_KV) return

    const stored = {
      sessionId,
      providerSessionId,
      provider: 'browserbase' as const,
      status: session.status,
      connectUrl: session.connectUrl,
      debuggerUrl: session.debuggerUrl,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    }

    await this.env.OAUTH_KV.put(sessionId, JSON.stringify(stored), {
      expirationTtl: 86400, // 24 hours
    })
  }

  private async getSessionMapping(sessionId: string): Promise<{
    providerSessionId: string
    connectUrl?: string
    debuggerUrl?: string
    createdAt: number
    expiresAt?: number
    status: SessionStatus
  } | null> {
    if (!this.env.OAUTH_KV) return null

    const data = await this.env.OAUTH_KV.get(sessionId)
    if (!data) return null

    return JSON.parse(data)
  }
}
