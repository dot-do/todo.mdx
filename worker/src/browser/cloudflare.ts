/**
 * Cloudflare Browser Rendering Provider
 *
 * Free browser automation using Cloudflare's Browser Rendering API.
 * Sessions are stored in KV for persistence across worker instances.
 *
 * @see https://developers.cloudflare.com/browser-rendering/
 */

import type { Env } from '../types/env'
import type {
  BrowserProvider,
  BrowserSession,
  CreateSessionOptions,
  RrwebEvent,
  SessionStatus,
} from '../types/browser'

interface StoredSession {
  sessionId: string
  provider: 'cloudflare'
  status: SessionStatus
  createdAt: number
  expiresAt?: number
  userId?: string
}

export class CloudflareBrowserProvider implements BrowserProvider {
  readonly name = 'cloudflare'
  private env: Env

  constructor(env: Env) {
    this.env = env
  }

  async createSession(options: CreateSessionOptions): Promise<BrowserSession> {
    const sessionId = options.contextId
      ? `browser:${options.contextId}`
      : `browser:${crypto.randomUUID()}`

    const now = Date.now()
    const timeout = options.timeout ?? 60000 // Default 60 seconds

    const session: BrowserSession = {
      id: sessionId,
      provider: 'cloudflare',
      status: 'running',
      createdAt: now,
      expiresAt: now + timeout,
    }

    // Store in KV for persistence across worker instances (include userId for ownership)
    await this.storeSessionMapping(sessionId, session, options.userId)

    // Note: Actual Cloudflare Browser Rendering integration would happen here
    // using the BROWSER binding from env
    // For now, we create a session that can be used with puppeteer-core

    return session
  }

  async getSession(sessionId: string): Promise<BrowserSession | null> {
    // Get session from KV
    const stored = await this.getSessionMapping(sessionId)
    if (!stored) return null

    // Check if expired
    let status = stored.status
    if (stored.expiresAt && Date.now() > stored.expiresAt) {
      status = 'timed_out'
    }

    return {
      id: sessionId,
      provider: 'cloudflare',
      status,
      createdAt: stored.createdAt,
      expiresAt: stored.expiresAt,
    }
  }

  async releaseSession(sessionId: string): Promise<void> {
    const stored = await this.getSessionMapping(sessionId)
    if (stored) {
      // Update KV with completed status (preserve userId)
      const updatedSession: BrowserSession = {
        id: sessionId,
        provider: 'cloudflare',
        status: 'completed',
        createdAt: stored.createdAt,
        expiresAt: stored.expiresAt,
      }
      await this.storeSessionMapping(sessionId, updatedSession, stored.userId)
    }
  }

  async getRecording(_sessionId: string): Promise<RrwebEvent[] | null> {
    // Cloudflare Browser Rendering does not support recording
    return null
  }

  private async storeSessionMapping(
    sessionId: string,
    session: BrowserSession,
    userId?: string
  ): Promise<void> {
    if (!this.env.OAUTH_KV) return

    const stored: StoredSession = {
      sessionId,
      provider: 'cloudflare',
      status: session.status,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      userId,
    }

    await this.env.OAUTH_KV.put(sessionId, JSON.stringify(stored), {
      expirationTtl: 86400, // 24 hours
    })
  }

  private async getSessionMapping(sessionId: string): Promise<StoredSession | null> {
    if (!this.env.OAUTH_KV) return null

    const data = await this.env.OAUTH_KV.get(sessionId)
    if (!data) return null

    return JSON.parse(data)
  }
}
