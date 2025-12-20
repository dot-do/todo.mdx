/**
 * Repo Durable Object SQLite Schema
 * Per-repo state for syncing issues, files, and milestones
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

/**
 * Issues (from GitHub Issues + beads)
 */
export const issues = sqliteTable('issues', {
  id: integer('id').primaryKey(),
  // GitHub data
  githubId: integer('github_id').unique(),
  githubNumber: integer('github_number'),
  // Beads data
  beadsId: text('beads_id').unique(),
  // Shared fields
  title: text('title').notNull(),
  body: text('body'),
  state: text('state').notNull(), // 'open' | 'closed'
  labels: text('labels'), // JSON array
  assignees: text('assignees'), // JSON array
  priority: integer('priority'),
  type: text('type'), // 'task' | 'bug' | 'feature'
  // File mapping
  filePath: text('file_path'), // .todo/[id]-[title].md
  fileHash: text('file_hash'), // For change detection
  // Sync state
  githubUpdatedAt: text('github_updated_at'),
  beadsUpdatedAt: text('beads_updated_at'),
  fileUpdatedAt: text('file_updated_at'),
  lastSyncAt: text('last_sync_at'),
  syncSource: text('sync_source'), // 'github' | 'beads' | 'file'
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

/**
 * Milestones (from GitHub Milestones + beads epics)
 */
export const milestones = sqliteTable('milestones', {
  id: integer('id').primaryKey(),
  // GitHub data
  githubId: integer('github_id').unique(),
  githubNumber: integer('github_number'),
  // Beads data
  beadsId: text('beads_id').unique(),
  // Shared fields
  title: text('title').notNull(),
  description: text('description'),
  state: text('state').notNull(), // 'open' | 'closed'
  dueOn: text('due_on'),
  // File mapping
  filePath: text('file_path'), // .roadmap/[id]-[title].md
  fileHash: text('file_hash'),
  // Sync state
  githubUpdatedAt: text('github_updated_at'),
  beadsUpdatedAt: text('beads_updated_at'),
  fileUpdatedAt: text('file_updated_at'),
  lastSyncAt: text('last_sync_at'),
  syncSource: text('sync_source'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

/**
 * Sync log for debugging and audit
 */
export const syncLog = sqliteTable('sync_log', {
  id: integer('id').primaryKey(),
  entityType: text('entity_type').notNull(), // 'issue' | 'milestone'
  entityId: integer('entity_id').notNull(),
  action: text('action').notNull(), // 'create' | 'update' | 'delete'
  source: text('source').notNull(), // 'github' | 'beads' | 'file'
  target: text('target').notNull(), // 'github' | 'beads' | 'file'
  changes: text('changes'), // JSON diff
  status: text('status').notNull(), // 'success' | 'failed'
  error: text('error'),
  createdAt: text('created_at').notNull(),
})
