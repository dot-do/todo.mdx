/**
 * Direct D1 Database Access
 *
 * Bypasses Payload CMS for simple CRUD operations in webhook handlers.
 * This avoids Payload's Node.js dependencies that don't work in Workers.
 */

import type { Env } from '../types'

interface Installation {
  id: string
  installationId: number
  accountType: string
  accountId: number
  accountLogin: string
  accountAvatarUrl?: string
  permissions?: Record<string, string>
  events?: string[]
  repositorySelection?: string
  createdAt?: string
  updatedAt?: string
}

interface Repo {
  id: string
  githubId: number
  name: string
  fullName: string
  owner: string
  private: boolean
  installation: string
  createdAt?: string
  updatedAt?: string
}

/**
 * Create direct D1 operations for webhook handlers
 */
export function createDirectDb(env: Env) {
  const db = env.DB

  return {
    installations: {
      async findByInstallationId(installationId: number): Promise<Installation | null> {
        const result = await db.prepare(
          'SELECT * FROM installations WHERE installationId = ? LIMIT 1'
        ).bind(installationId).first<Installation>()
        return result || null
      },

      async create(data: Omit<Installation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Installation> {
        const id = crypto.randomUUID()
        const now = new Date().toISOString()
        await db.prepare(
          `INSERT INTO installations (id, installationId, accountType, accountId, accountLogin, accountAvatarUrl, repositorySelection, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          data.installationId,
          data.accountType,
          data.accountId,
          data.accountLogin,
          data.accountAvatarUrl || null,
          data.repositorySelection || 'all',
          now,
          now
        ).run()

        return { ...data, id, createdAt: now, updatedAt: now }
      },

      async delete(installationId: number): Promise<void> {
        await db.prepare(
          'DELETE FROM installations WHERE installationId = ?'
        ).bind(installationId).run()
      },
    },

    repos: {
      async findByGithubId(githubId: number): Promise<Repo | null> {
        const result = await db.prepare(
          'SELECT * FROM repos WHERE githubId = ? LIMIT 1'
        ).bind(githubId).first<Repo>()
        return result || null
      },

      async create(data: Omit<Repo, 'id' | 'createdAt' | 'updatedAt'>): Promise<Repo> {
        const id = crypto.randomUUID()
        const now = new Date().toISOString()
        await db.prepare(
          `INSERT INTO repos (id, githubId, name, fullName, owner, private, installation, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          data.githubId,
          data.name,
          data.fullName,
          data.owner,
          data.private ? 1 : 0,
          data.installation,
          now,
          now
        ).run()

        return { ...data, id, createdAt: now, updatedAt: now }
      },

      async deleteByInstallation(installationId: string): Promise<void> {
        await db.prepare(
          'DELETE FROM repos WHERE installation = ?'
        ).bind(installationId).run()
      },
    },

    users: {
      async findByWorkosUserId(workosUserId: string): Promise<{ id: string; email: string; name?: string } | null> {
        const result = await db.prepare(
          'SELECT * FROM users WHERE workosUserId = ? LIMIT 1'
        ).bind(workosUserId).first<any>()
        return result || null
      },

      async create(data: { email: string; workosUserId: string; name?: string }): Promise<{ id: string }> {
        const id = crypto.randomUUID()
        const now = new Date().toISOString()
        await db.prepare(
          `INSERT INTO users (id, email, workosUserId, name, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(id, data.email, data.workosUserId, data.name || null, now, now).run()
        return { id }
      },

      async update(id: string, data: { email?: string; name?: string }): Promise<void> {
        const sets: string[] = []
        const values: any[] = []

        if (data.email !== undefined) {
          sets.push('email = ?')
          values.push(data.email)
        }
        if (data.name !== undefined) {
          sets.push('name = ?')
          values.push(data.name)
        }
        sets.push('updatedAt = ?')
        values.push(new Date().toISOString())
        values.push(id)

        if (sets.length > 1) {
          await db.prepare(
            `UPDATE users SET ${sets.join(', ')} WHERE id = ?`
          ).bind(...values).run()
        }
      },
    },
  }
}

export type DirectDb = ReturnType<typeof createDirectDb>
