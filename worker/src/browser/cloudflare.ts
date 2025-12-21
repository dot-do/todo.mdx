/**
 * Cloudflare Browser Rendering Provider
 *
 * Free browser automation using Cloudflare's Browser Rendering API.
 * Ephemeral sessions only - no persistence or recording.
 *
 * @see https://developers.cloudflare.com/browser-rendering/
 */

import type { Env } from '../types/env'
import type {
  BrowserProvider,
  BrowserSession,
  CreateSessionOptions,
  RrwebEvent,
} from '../types/browser'

export class CloudflareBrowserProvider implements BrowserProvider {
  readonly name = 'cloudflare'
  private env: Env
  private sessions: Map<string, BrowserSession> = new Map()

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

    // Store in memory (ephemeral)
    this.sessions.set(sessionId, session)

    // Note: Actual Cloudflare Browser Rendering integration would happen here
    // using the BROWSER binding from env
    // For now, we create a session that can be used with puppeteer-core

    return session
  }

  async getSession(sessionId: string): Promise<BrowserSession | null> {
    const session = this.sessions.get(sessionId)
    if (!session) return null

    // Check if expired
    if (session.expiresAt && Date.now() > session.expiresAt) {
      session.status = 'timed_out'
    }

    return session
  }

  async releaseSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.status = 'completed'
      // Clean up after a delay to allow final status checks
      setTimeout(() => this.sessions.delete(sessionId), 5000)
    }
  }

  async getRecording(sessionId: string): Promise<RrwebEvent[] | null> {
    // Cloudflare Browser Rendering does not support recording
    return null
  }
}
