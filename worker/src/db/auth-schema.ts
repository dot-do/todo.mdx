/**
 * Auth schema for Better Auth + custom tables
 * Uses Drizzle ORM with D1 (SQLite)
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// ============================================
// Better Auth core tables
// ============================================

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  // Custom fields for GitHub
  githubId: integer('github_id'),
  githubUsername: text('github_username'),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const verifications = sqliteTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
})

// ============================================
// GitHub App tables (custom)
// ============================================

export const installations = sqliteTable('installations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  installationId: integer('installation_id').notNull().unique(),
  accountType: text('account_type').notNull(), // 'User' | 'Organization'
  accountId: integer('account_id').notNull(),
  accountLogin: text('account_login').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  suspendedAt: text('suspended_at'),
})

export const repos = sqliteTable('repos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  installationId: integer('installation_id').notNull(),
  repoId: integer('repo_id').notNull().unique(),
  owner: text('owner').notNull(),
  name: text('name').notNull(),
  fullName: text('full_name').notNull(),
  doId: text('do_id').notNull(),
  syncEnabled: integer('sync_enabled', { mode: 'boolean' }).notNull().default(true),
  lastSyncAt: text('last_sync_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  installationId: integer('installation_id').notNull(),
  projectId: integer('project_id').notNull().unique(),
  projectNumber: integer('project_number').notNull(),
  owner: text('owner').notNull(),
  title: text('title').notNull(),
  doId: text('do_id').notNull(),
  syncEnabled: integer('sync_enabled', { mode: 'boolean' }).notNull().default(true),
  lastSyncAt: text('last_sync_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const repoProjects = sqliteTable('repo_projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  repoId: integer('repo_id').notNull(),
  projectId: integer('project_id').notNull(),
  createdAt: text('created_at').notNull(),
})

// ============================================
// User <-> Installation linking
// ============================================

export const userInstallations = sqliteTable('user_installations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  installationId: integer('installation_id').notNull(),
  role: text('role').notNull().default('member'), // 'owner' | 'admin' | 'member'
  createdAt: text('created_at').notNull(),
})
