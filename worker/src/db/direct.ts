/**
 * Direct D1 Database Access via Drizzle ORM
 *
 * Type-safe database operations for webhook handlers.
 * Uses Drizzle ORM with schema matching Payload CMS tables.
 */

import { eq } from 'drizzle-orm'
import type { Env } from '../types'
import { createDrizzle, installations, repos, users, installationsRels } from './drizzle'
import type { Installation, Repo, User, NewInstallation, NewRepo, NewUser } from './schema'

/**
 * Create direct database operations for webhook handlers
 */
export function createDirectDb(env: Env) {
  const db = createDrizzle(env.DB)

  return {
    installations: {
      async findByInstallationId(installationId: number): Promise<Installation | null> {
        const result = await db
          .select()
          .from(installations)
          .where(eq(installations.installationId, installationId))
          .limit(1)

        return result[0] || null
      },

      async create(data: {
        installationId: number
        accountType: string
        accountId: number
        accountLogin: string
        accountAvatarUrl?: string
        permissions?: Record<string, string>
        events?: string[]
        repositorySelection?: string
      }): Promise<Installation> {
        const now = new Date().toISOString()

        const result = await db
          .insert(installations)
          .values({
            installationId: data.installationId,
            accountType: data.accountType,
            accountId: data.accountId,
            accountLogin: data.accountLogin,
            accountAvatarUrl: data.accountAvatarUrl || null,
            permissions: data.permissions ? JSON.stringify(data.permissions) : null,
            events: data.events ? JSON.stringify(data.events) : null,
            repositorySelection: data.repositorySelection || 'all',
            createdAt: now,
            updatedAt: now,
          })
          .returning()

        return result[0]
      },

      async delete(installationId: number): Promise<void> {
        await db
          .delete(installations)
          .where(eq(installations.installationId, installationId))
      },
    },

    repos: {
      async findByGithubId(githubId: number): Promise<Repo | null> {
        const result = await db
          .select()
          .from(repos)
          .where(eq(repos.githubId, githubId))
          .limit(1)

        return result[0] || null
      },

      async create(data: {
        githubId: number
        name: string
        fullName: string
        owner: string
        private: boolean
        installationId: number
        defaultBranch?: string
      }): Promise<Repo> {
        const now = new Date().toISOString()

        const result = await db
          .insert(repos)
          .values({
            githubId: data.githubId,
            name: data.name,
            fullName: data.fullName,
            owner: data.owner,
            private: data.private,
            installationId: data.installationId,
            defaultBranch: data.defaultBranch || 'main',
            syncEnabled: true,
            syncPath: '.todo',
            syncStatus: 'idle',
            createdAt: now,
            updatedAt: now,
          })
          .returning()

        return result[0]
      },

      async deleteByInstallation(installationId: number): Promise<void> {
        await db
          .delete(repos)
          .where(eq(repos.installationId, installationId))
      },
    },

    users: {
      async findByWorkosUserId(workosUserId: string): Promise<User | null> {
        const result = await db
          .select()
          .from(users)
          .where(eq(users.workosUserId, workosUserId))
          .limit(1)

        return result[0] || null
      },

      async findByEmail(email: string): Promise<User | null> {
        const result = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1)

        return result[0] || null
      },

      async create(data: {
        email: string
        workosUserId: string
        name?: string
        githubId?: number
        githubLogin?: string
        githubAvatarUrl?: string
      }): Promise<User> {
        const now = new Date().toISOString()

        const result = await db
          .insert(users)
          .values({
            email: data.email,
            workosUserId: data.workosUserId,
            name: data.name || null,
            githubId: data.githubId || null,
            githubLogin: data.githubLogin || null,
            githubAvatarUrl: data.githubAvatarUrl || null,
            createdAt: now,
            updatedAt: now,
          })
          .returning()

        return result[0]
      },

      async update(id: number, data: {
        email?: string
        name?: string
        githubId?: number
        githubLogin?: string
        githubAvatarUrl?: string
      }): Promise<User | null> {
        const result = await db
          .update(users)
          .set({
            ...data,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(users.id, id))
          .returning()

        return result[0] || null
      },

      async upsertByWorkosUserId(data: {
        email: string
        workosUserId: string
        name?: string
        githubId?: number
        githubLogin?: string
        githubAvatarUrl?: string
      }): Promise<User> {
        const existing = await this.findByWorkosUserId(data.workosUserId)

        if (existing) {
          const updated = await this.update(existing.id, {
            email: data.email,
            name: data.name,
            githubId: data.githubId,
            githubLogin: data.githubLogin,
            githubAvatarUrl: data.githubAvatarUrl,
          })
          return updated!
        }

        return this.create(data)
      },
    },

    // Raw Drizzle access for complex queries
    db,
  }
}

export type DirectDb = ReturnType<typeof createDirectDb>
