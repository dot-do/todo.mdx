/**
 * Project Durable Object SQLite Schema
 * Per-GitHub-Project state for cross-repo roadmap sync
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

/**
 * Repos linked to this project
 */
export const linkedRepos = sqliteTable('linked_repos', {
  id: integer('id').primaryKey(),
  repoId: integer('repo_id').notNull(),
  owner: text('owner').notNull(),
  name: text('name').notNull(),
  fullName: text('full_name').notNull(),
  addedAt: text('added_at').notNull(),
})

/**
 * Project items (cards/issues from GitHub Projects v2)
 */
export const projectItems = sqliteTable('project_items', {
  id: integer('id').primaryKey(),
  githubItemId: text('github_item_id').notNull().unique(),
  contentType: text('content_type').notNull(), // 'Issue' | 'PullRequest' | 'DraftIssue'
  contentId: integer('content_id'), // GitHub Issue/PR ID
  repoId: integer('repo_id'),
  // Project fields
  title: text('title').notNull(),
  status: text('status'), // Custom field value
  priority: text('priority'), // Custom field value
  iteration: text('iteration'), // Custom field value
  // Cross-repo milestone mapping
  milestoneTitle: text('milestone_title'),
  // Sync state
  githubUpdatedAt: text('github_updated_at'),
  lastSyncAt: text('last_sync_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

/**
 * Project fields configuration (from GitHub Projects v2)
 */
export const projectFields = sqliteTable('project_fields', {
  id: integer('id').primaryKey(),
  githubFieldId: text('github_field_id').notNull().unique(),
  name: text('name').notNull(),
  dataType: text('data_type').notNull(), // 'TEXT' | 'NUMBER' | 'DATE' | 'SINGLE_SELECT' | 'ITERATION'
  options: text('options'), // JSON for SINGLE_SELECT options
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

/**
 * Cross-repo milestone sync mapping
 */
export const milestoneMappings = sqliteTable('milestone_mappings', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(), // Common milestone title
  repoMilestones: text('repo_milestones').notNull(), // JSON: { repoId: milestoneId }
  dueOn: text('due_on'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

/**
 * Sync log
 */
export const syncLog = sqliteTable('sync_log', {
  id: integer('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),
  details: text('details'), // JSON
  status: text('status').notNull(),
  error: text('error'),
  createdAt: text('created_at').notNull(),
})
