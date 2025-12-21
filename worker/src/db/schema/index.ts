/**
 * Drizzle schema for the todo.mdx D1 database
 *
 * Generated from Payload CMS schema - matches the tables created by @payloadcms/db-d1-sqlite
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

// ============================================
// Users
// ============================================

export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  githubId: real('github_id'),
  githubLogin: text('github_login'),
  githubAvatarUrl: text('github_avatar_url'),
  name: text('name'),
  workosUserId: text('workos_user_id'),
  updatedAt: text('updated_at').notNull(),
  createdAt: text('created_at').notNull(),
  email: text('email').notNull(),
  resetPasswordToken: text('reset_password_token'),
  resetPasswordExpiration: text('reset_password_expiration'),
  salt: text('salt'),
  hash: text('hash'),
  loginAttempts: real('login_attempts').default(0),
  lockUntil: text('lock_until'),
})

export const usersRoles = sqliteTable('users_roles', {
  id: integer('id').primaryKey(),
  order: integer('order').notNull(),
  parentId: integer('parent_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  value: text('value'),
})

export const usersSessions = sqliteTable('users_sessions', {
  id: text('id').primaryKey(),
  _order: integer('_order').notNull(),
  _parentId: integer('_parent_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at'),
  expiresAt: text('expires_at').notNull(),
})

// ============================================
// Installations (GitHub App)
// ============================================

export const installations = sqliteTable('installations', {
  id: integer('id').primaryKey(),
  installationId: real('installation_id').notNull(),
  accountId: real('account_id').notNull(),
  accountLogin: text('account_login').notNull(),
  accountType: text('account_type').notNull(),
  accountAvatarUrl: text('account_avatar_url'),
  permissions: text('permissions'), // JSON
  events: text('events'), // JSON array
  repositorySelection: text('repository_selection').default('selected'),
  suspendedAt: text('suspended_at'),
  updatedAt: text('updated_at').notNull(),
  createdAt: text('created_at').notNull(),
})

export const installationsRels = sqliteTable('installations_rels', {
  id: integer('id').primaryKey(),
  order: integer('order'),
  parentId: integer('parent_id').notNull().references(() => installations.id, { onDelete: 'cascade' }),
  path: text('path').notNull(),
  usersId: integer('users_id').references(() => users.id, { onDelete: 'cascade' }),
})

// ============================================
// Repos
// ============================================

export const repos = sqliteTable('repos', {
  id: integer('id').primaryKey(),
  githubId: real('github_id').notNull(),
  name: text('name').notNull(),
  fullName: text('full_name').notNull(),
  owner: text('owner').notNull(),
  private: integer('private', { mode: 'boolean' }).default(false),
  defaultBranch: text('default_branch').default('main'),
  installationId: integer('installation_id').notNull().references(() => installations.id, { onDelete: 'set null' }),
  syncEnabled: integer('sync_enabled', { mode: 'boolean' }).default(true),
  syncPath: text('sync_path').default('.todo'),
  lastSyncAt: text('last_sync_at'),
  syncStatus: text('sync_status').default('idle'),
  syncError: text('sync_error'),
  updatedAt: text('updated_at').notNull(),
  createdAt: text('created_at').notNull(),
})

// ============================================
// Milestones
// ============================================

export const milestones = sqliteTable('milestones', {
  id: integer('id').primaryKey(),
  localId: text('local_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  state: text('state').notNull().default('open'),
  dueOn: text('due_on'),
  githubNumber: real('github_number'),
  githubId: real('github_id'),
  repoId: integer('repo_id').notNull().references(() => repos.id, { onDelete: 'set null' }),
  linearDataNumber: real('linear_data_number'),
  linearDataStartsAt: text('linear_data_starts_at'),
  updatedAt: text('updated_at').notNull(),
  createdAt: text('created_at').notNull(),
})

// ============================================
// Issues
// ============================================

export const issues = sqliteTable('issues', {
  id: integer('id').primaryKey(),
  localId: text('local_id').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  state: text('state').notNull().default('open'),
  status: text('status').default('open'),
  priority: real('priority').default(2),
  labels: text('labels'), // JSON array
  assignees: text('assignees'), // JSON array
  githubNumber: real('github_number'),
  githubId: real('github_id'),
  githubUrl: text('github_url'),
  repoId: integer('repo_id').notNull().references(() => repos.id, { onDelete: 'set null' }),
  milestoneId: integer('milestone_id').references(() => milestones.id, { onDelete: 'set null' }),
  type: text('type').default('task'),
  closedAt: text('closed_at'),
  closeReason: text('close_reason'),
  linearDataIdentifier: text('linear_data_identifier'),
  linearDataStateId: text('linear_data_state_id'),
  linearDataStateName: text('linear_data_state_name'),
  linearDataCycleId: text('linear_data_cycle_id'),
  linearDataProjectId: text('linear_data_project_id'),
  updatedAt: text('updated_at').notNull(),
  createdAt: text('created_at').notNull(),
})

export const issuesRels = sqliteTable('issues_rels', {
  id: integer('id').primaryKey(),
  order: integer('order'),
  parentId: integer('parent_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  path: text('path').notNull(),
  issuesId: integer('issues_id').references(() => issues.id, { onDelete: 'cascade' }),
})

// ============================================
// Sync Events
// ============================================

export const syncEvents = sqliteTable('sync_events', {
  id: integer('id').primaryKey(),
  eventType: text('event_type').notNull(),
  direction: text('direction').notNull(),
  status: text('status').notNull().default('pending'),
  payload: text('payload'), // JSON
  error: text('error'),
  conflictResolution: text('conflict_resolution'),
  repoId: integer('repo_id').notNull().references(() => repos.id, { onDelete: 'set null' }),
  issueId: integer('issue_id').references(() => issues.id, { onDelete: 'set null' }),
  milestoneId: integer('milestone_id').references(() => milestones.id, { onDelete: 'set null' }),
  processedAt: text('processed_at'),
  retryCount: real('retry_count').default(0),
  updatedAt: text('updated_at').notNull(),
  createdAt: text('created_at').notNull(),
})

// ============================================
// Linear Integrations
// ============================================

export const linearIntegrations = sqliteTable('linear_integrations', {
  id: integer('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'set null' }),
  repoId: integer('repo_id').references(() => repos.id, { onDelete: 'set null' }),
  linearDataOrganizationId: text('linear_data_organization_id').notNull(),
  linearDataOrganizationName: text('linear_data_organization_name').notNull(),
  linearDataUrlKey: text('linear_data_url_key'),
  linearDataUserId: text('linear_data_user_id'),
  linearDataUserEmail: text('linear_data_user_email'),
  linearDataTeamId: text('linear_data_team_id'),
  linearDataTeamName: text('linear_data_team_name'),
  webhookId: text('webhook_id'),
  webhookSecret: text('webhook_secret'),
  active: integer('active', { mode: 'boolean' }).default(true),
  lastSyncAt: text('last_sync_at'),
  lastSyncResult: text('last_sync_result'),
  syncSettingsAutoSync: integer('sync_settings_auto_sync', { mode: 'boolean' }).default(true),
  syncSettingsSyncCycles: integer('sync_settings_sync_cycles', { mode: 'boolean' }).default(true),
  syncSettingsSyncProjects: integer('sync_settings_sync_projects', { mode: 'boolean' }).default(true),
  syncSettingsSyncLabels: integer('sync_settings_sync_labels', { mode: 'boolean' }).default(true),
  updatedAt: text('updated_at').notNull(),
  createdAt: text('created_at').notNull(),
})

// ============================================
// Media
// ============================================

export const media = sqliteTable('media', {
  id: integer('id').primaryKey(),
  alt: text('alt').notNull(),
  updatedAt: text('updated_at').notNull(),
  createdAt: text('created_at').notNull(),
  url: text('url'),
  thumbnailURL: text('thumbnail_u_r_l'),
  filename: text('filename'),
  mimeType: text('mime_type'),
  filesize: real('filesize'),
  width: real('width'),
  height: real('height'),
})

// ============================================
// Models
// ============================================

export const models = sqliteTable('models', {
  id: integer('id').primaryKey(),
  modelId: text('model_id').notNull().unique(),
  name: text('name'),
  provider: text('provider'),
  contextLength: real('context_length'),
  pricing: text('pricing'), // JSON
  capabilities: text('capabilities'), // JSON
  lastSyncedAt: text('last_synced_at'),
  status: text('status').default('available'),
  tier: text('tier'),
  bestFor: text('best_for'), // JSON array
  notes: text('notes'),
  updatedAt: text('updated_at').notNull(),
  createdAt: text('created_at').notNull(),
})

// ============================================
// Model Defaults
// ============================================

export const modelDefaults = sqliteTable('model_defaults', {
  id: integer('id').primaryKey(),
  useCase: text('use_case').notNull(),
  taskType: text('task_type'),
  modelId: integer('model_id').notNull().references(() => models.id, { onDelete: 'cascade' }),
  orgId: integer('org_id').references(() => installations.id, { onDelete: 'cascade' }),
  updatedAt: text('updated_at').notNull(),
  createdAt: text('created_at').notNull(),
})

// ============================================
// Relations
// ============================================

export const usersRelations = relations(users, ({ many }) => ({
  roles: many(usersRoles),
  sessions: many(usersSessions),
}))

export const installationsRelations = relations(installations, ({ many, one }) => ({
  rels: many(installationsRels),
  repos: many(repos),
}))

export const reposRelations = relations(repos, ({ one, many }) => ({
  installation: one(installations, {
    fields: [repos.installationId],
    references: [installations.id],
  }),
  issues: many(issues),
  milestones: many(milestones),
}))

export const issuesRelations = relations(issues, ({ one, many }) => ({
  repo: one(repos, {
    fields: [issues.repoId],
    references: [repos.id],
  }),
  milestone: one(milestones, {
    fields: [issues.milestoneId],
    references: [milestones.id],
  }),
  rels: many(issuesRels),
}))

export const milestonesRelations = relations(milestones, ({ one, many }) => ({
  repo: one(repos, {
    fields: [milestones.repoId],
    references: [repos.id],
  }),
  issues: many(issues),
}))

export const modelsRelations = relations(models, ({ many }) => ({
  defaults: many(modelDefaults),
}))

export const modelDefaultsRelations = relations(modelDefaults, ({ one }) => ({
  model: one(models, {
    fields: [modelDefaults.modelId],
    references: [models.id],
  }),
  org: one(installations, {
    fields: [modelDefaults.orgId],
    references: [installations.id],
  }),
}))

// ============================================
// Type exports
// ============================================

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Installation = typeof installations.$inferSelect
export type NewInstallation = typeof installations.$inferInsert

export type Repo = typeof repos.$inferSelect
export type NewRepo = typeof repos.$inferInsert

export type Issue = typeof issues.$inferSelect
export type NewIssue = typeof issues.$inferInsert

export type Milestone = typeof milestones.$inferSelect
export type NewMilestone = typeof milestones.$inferInsert

export type SyncEvent = typeof syncEvents.$inferSelect
export type NewSyncEvent = typeof syncEvents.$inferInsert

export type LinearIntegration = typeof linearIntegrations.$inferSelect
export type NewLinearIntegration = typeof linearIntegrations.$inferInsert

export type Media = typeof media.$inferSelect
export type NewMedia = typeof media.$inferInsert

export type Model = typeof models.$inferSelect
export type NewModel = typeof models.$inferInsert

export type ModelDefault = typeof modelDefaults.$inferSelect
export type NewModelDefault = typeof modelDefaults.$inferInsert
