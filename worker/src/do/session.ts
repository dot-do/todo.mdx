/**
 * SessionDO - Durable Object for storing user sessions and tokens
 *
 * Replaces KV for session storage to avoid key length limits.
 * Uses SQLite for efficient lookups and automatic expiration.
 */

import { DurableObject } from 'cloudflare:workers'
import type { Env } from '../types'

export interface Session {
  id: string
  userId: string
  email?: string
  name?: string
  data?: Record<string, unknown>
  createdAt: number
  expiresAt: number
}

export class SessionDO extends DurableObject<Env> {
  private sql!: SqlStorage
  private initialized = false

  private async ensureInitialized() {
    if (this.initialized) return

    this.sql = this.ctx.storage.sql

    // Create tables
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        email TEXT,
        name TEXT,
        data TEXT,
        source TEXT NOT NULL DEFAULT 'oauth',
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    `)

    this.initialized = true
  }

  /**
   * Hash a token using SHA-256 for storage
   */
  private async hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(token)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Store a session for a token
   */
  async createSession(
    token: string,
    session: Omit<Session, 'id' | 'createdAt' | 'expiresAt'> & { ttlSeconds?: number }
  ): Promise<Session> {
    await this.ensureInitialized()

    const id = crypto.randomUUID()
    const tokenHash = await this.hashToken(token)
    const createdAt = Date.now()
    const expiresAt = createdAt + (session.ttlSeconds ?? 3600) * 1000

    this.sql.exec(
      `INSERT OR REPLACE INTO sessions (id, token_hash, user_id, email, name, data, source, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      tokenHash,
      session.userId,
      session.email ?? null,
      session.name ?? null,
      session.data ? JSON.stringify(session.data) : null,
      (session as any).source ?? 'oauth',
      createdAt,
      expiresAt
    )

    return {
      id,
      userId: session.userId,
      email: session.email,
      name: session.name,
      data: session.data,
      createdAt,
      expiresAt,
    }
  }

  /**
   * Get session by token
   */
  async getSession(token: string): Promise<Session | null> {
    await this.ensureInitialized()

    const tokenHash = await this.hashToken(token)
    const now = Date.now()

    const result = this.sql.exec(
      `SELECT id, user_id, email, name, data, created_at, expires_at
       FROM sessions
       WHERE token_hash = ? AND expires_at > ?`,
      tokenHash,
      now
    ).toArray()

    if (result.length === 0) return null

    const row = result[0] as any
    return {
      id: row.id,
      userId: row.user_id,
      email: row.email,
      name: row.name,
      data: row.data ? JSON.parse(row.data) : undefined,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }
  }

  /**
   * Delete a session by token
   */
  async deleteSession(token: string): Promise<boolean> {
    await this.ensureInitialized()

    const tokenHash = await this.hashToken(token)

    const result = this.sql.exec(
      `DELETE FROM sessions WHERE token_hash = ?`,
      tokenHash
    )

    return result.rowsWritten > 0
  }

  /**
   * Delete all sessions for a user
   */
  async deleteUserSessions(userId: string): Promise<number> {
    await this.ensureInitialized()

    const result = this.sql.exec(
      `DELETE FROM sessions WHERE user_id = ?`,
      userId
    )

    return result.rowsWritten
  }

  /**
   * Clean up expired sessions
   */
  async cleanup(): Promise<number> {
    await this.ensureInitialized()

    const now = Date.now()
    const result = this.sql.exec(
      `DELETE FROM sessions WHERE expires_at < ?`,
      now
    )

    return result.rowsWritten
  }

  /**
   * HTTP interface
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    try {
      // POST /sessions - Create session
      if (path === '/sessions' && request.method === 'POST') {
        const body = await request.json() as {
          token: string
          userId: string
          email?: string
          name?: string
          data?: Record<string, unknown>
          source?: string
          ttlSeconds?: number
        }

        const session = await this.createSession(body.token, {
          userId: body.userId,
          email: body.email,
          name: body.name,
          data: body.data,
          source: body.source,
          ttlSeconds: body.ttlSeconds,
        } as any)

        return Response.json(session)
      }

      // POST /sessions/validate - Validate token and get session
      if (path === '/sessions/validate' && request.method === 'POST') {
        const body = await request.json() as { token: string }
        const session = await this.getSession(body.token)

        if (!session) {
          return Response.json({ error: 'Session not found or expired' }, { status: 404 })
        }

        return Response.json(session)
      }

      // DELETE /sessions - Delete by token
      if (path === '/sessions' && request.method === 'DELETE') {
        const body = await request.json() as { token: string }
        const deleted = await this.deleteSession(body.token)

        return Response.json({ deleted })
      }

      // POST /sessions/cleanup - Clean expired sessions
      if (path === '/sessions/cleanup' && request.method === 'POST') {
        const deleted = await this.cleanup()
        return Response.json({ deleted })
      }

      return Response.json({ error: 'Not found' }, { status: 404 })
    } catch (error: any) {
      console.error('[SessionDO] Error:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }
  }
}
