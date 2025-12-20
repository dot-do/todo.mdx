/**
 * D1 Schema - App installs and Durable Object registry
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

/**
 * GitHub App installations
 */
export const installations = sqliteTable('installations', {
  id: integer('id').primaryKey(),
  installationId: integer('installation_id').notNull().unique(),
  accountType: text('account_type').notNull(), // 'User' | 'Organization'
  accountId: integer('account_id').notNull(),
  accountLogin: text('account_login').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  suspendedAt: text('suspended_at'),
})

/**
 * Repos being synced (Durable Object instances)
 */
export const repos = sqliteTable('repos', {
  id: integer('id').primaryKey(),
  installationId: integer('installation_id').notNull(),
  repoId: integer('repo_id').notNull().unique(),
  owner: text('owner').notNull(),
  name: text('name').notNull(),
  fullName: text('full_name').notNull(),
  doId: text('do_id').notNull(), // Durable Object ID
  syncEnabled: integer('sync_enabled', { mode: 'boolean' }).notNull().default(true),
  lastSyncAt: text('last_sync_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

/**
 * GitHub Projects being synced (Durable Object instances)
 */
export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey(),
  installationId: integer('installation_id').notNull(),
  projectId: integer('project_id').notNull().unique(),
  projectNumber: integer('project_number').notNull(),
  owner: text('owner').notNull(), // org or user
  title: text('title').notNull(),
  doId: text('do_id').notNull(), // Durable Object ID
  syncEnabled: integer('sync_enabled', { mode: 'boolean' }).notNull().default(true),
  lastSyncAt: text('last_sync_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

/**
 * Repo <-> Project associations
 */
export const repoProjects = sqliteTable('repo_projects', {
  id: integer('id').primaryKey(),
  repoId: integer('repo_id').notNull(),
  projectId: integer('project_id').notNull(),
  createdAt: text('created_at').notNull(),
})
