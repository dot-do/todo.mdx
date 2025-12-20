import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`users_roles\` (
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`users_roles_order_idx\` ON \`users_roles\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`users_roles_parent_idx\` ON \`users_roles\` (\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`users_sessions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`created_at\` text,
  	\`expires_at\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`users_sessions_order_idx\` ON \`users_sessions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`users_sessions_parent_id_idx\` ON \`users_sessions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`users\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`github_id\` numeric,
  	\`github_login\` text,
  	\`github_avatar_url\` text,
  	\`name\` text,
  	\`workos_user_id\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`email\` text NOT NULL,
  	\`reset_password_token\` text,
  	\`reset_password_expiration\` text,
  	\`salt\` text,
  	\`hash\` text,
  	\`login_attempts\` numeric DEFAULT 0,
  	\`lock_until\` text
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`users_github_id_idx\` ON \`users\` (\`github_id\`);`)
  await db.run(sql`CREATE INDEX \`users_github_login_idx\` ON \`users\` (\`github_login\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`users_workos_user_id_idx\` ON \`users\` (\`workos_user_id\`);`)
  await db.run(sql`CREATE INDEX \`users_updated_at_idx\` ON \`users\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`users_created_at_idx\` ON \`users\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`users_email_idx\` ON \`users\` (\`email\`);`)
  await db.run(sql`CREATE TABLE \`media\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`alt\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`url\` text,
  	\`thumbnail_u_r_l\` text,
  	\`filename\` text,
  	\`mime_type\` text,
  	\`filesize\` numeric,
  	\`width\` numeric,
  	\`height\` numeric
  );
  `)
  await db.run(sql`CREATE INDEX \`media_updated_at_idx\` ON \`media\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`media_created_at_idx\` ON \`media\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`media_filename_idx\` ON \`media\` (\`filename\`);`)
  await db.run(sql`CREATE TABLE \`installations\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`installation_id\` numeric NOT NULL,
  	\`account_id\` numeric NOT NULL,
  	\`account_login\` text NOT NULL,
  	\`account_type\` text NOT NULL,
  	\`account_avatar_url\` text,
  	\`permissions\` text,
  	\`events\` text,
  	\`repository_selection\` text DEFAULT 'selected',
  	\`suspended_at\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`installations_installation_id_idx\` ON \`installations\` (\`installation_id\`);`)
  await db.run(sql`CREATE INDEX \`installations_account_id_idx\` ON \`installations\` (\`account_id\`);`)
  await db.run(sql`CREATE INDEX \`installations_account_login_idx\` ON \`installations\` (\`account_login\`);`)
  await db.run(sql`CREATE INDEX \`installations_updated_at_idx\` ON \`installations\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`installations_created_at_idx\` ON \`installations\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`installations_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`installations\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`installations_rels_order_idx\` ON \`installations_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`installations_rels_parent_idx\` ON \`installations_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`installations_rels_path_idx\` ON \`installations_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`installations_rels_users_id_idx\` ON \`installations_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`repos\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`github_id\` numeric NOT NULL,
  	\`name\` text NOT NULL,
  	\`full_name\` text NOT NULL,
  	\`owner\` text NOT NULL,
  	\`private\` integer DEFAULT false,
  	\`default_branch\` text DEFAULT 'main',
  	\`installation_id\` integer NOT NULL,
  	\`sync_enabled\` integer DEFAULT true,
  	\`sync_path\` text DEFAULT '.todo',
  	\`last_sync_at\` text,
  	\`sync_status\` text DEFAULT 'idle',
  	\`sync_error\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`installation_id\`) REFERENCES \`installations\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`repos_github_id_idx\` ON \`repos\` (\`github_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`repos_full_name_idx\` ON \`repos\` (\`full_name\`);`)
  await db.run(sql`CREATE INDEX \`repos_owner_idx\` ON \`repos\` (\`owner\`);`)
  await db.run(sql`CREATE INDEX \`repos_installation_idx\` ON \`repos\` (\`installation_id\`);`)
  await db.run(sql`CREATE INDEX \`repos_updated_at_idx\` ON \`repos\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`repos_created_at_idx\` ON \`repos\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`issues\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`local_id\` text NOT NULL,
  	\`title\` text NOT NULL,
  	\`body\` text,
  	\`state\` text DEFAULT 'open' NOT NULL,
  	\`status\` text DEFAULT 'open',
  	\`priority\` numeric DEFAULT 2,
  	\`labels\` text,
  	\`assignees\` text,
  	\`github_number\` numeric,
  	\`github_id\` numeric,
  	\`github_url\` text,
  	\`repo_id\` integer NOT NULL,
  	\`milestone_id\` integer,
  	\`type\` text DEFAULT 'task',
  	\`closed_at\` text,
  	\`close_reason\` text,
  	\`linear_data_identifier\` text,
  	\`linear_data_state_id\` text,
  	\`linear_data_state_name\` text,
  	\`linear_data_cycle_id\` text,
  	\`linear_data_project_id\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`repo_id\`) REFERENCES \`repos\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`milestone_id\`) REFERENCES \`milestones\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`issues_local_id_idx\` ON \`issues\` (\`local_id\`);`)
  await db.run(sql`CREATE INDEX \`issues_state_idx\` ON \`issues\` (\`state\`);`)
  await db.run(sql`CREATE INDEX \`issues_github_number_idx\` ON \`issues\` (\`github_number\`);`)
  await db.run(sql`CREATE INDEX \`issues_github_id_idx\` ON \`issues\` (\`github_id\`);`)
  await db.run(sql`CREATE INDEX \`issues_repo_idx\` ON \`issues\` (\`repo_id\`);`)
  await db.run(sql`CREATE INDEX \`issues_milestone_idx\` ON \`issues\` (\`milestone_id\`);`)
  await db.run(sql`CREATE INDEX \`issues_updated_at_idx\` ON \`issues\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`issues_created_at_idx\` ON \`issues\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`issues_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`issues_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`issues\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`issues_id\`) REFERENCES \`issues\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`issues_rels_order_idx\` ON \`issues_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`issues_rels_parent_idx\` ON \`issues_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`issues_rels_path_idx\` ON \`issues_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`issues_rels_issues_id_idx\` ON \`issues_rels\` (\`issues_id\`);`)
  await db.run(sql`CREATE TABLE \`milestones\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`local_id\` text NOT NULL,
  	\`title\` text NOT NULL,
  	\`description\` text,
  	\`state\` text DEFAULT 'open' NOT NULL,
  	\`due_on\` text,
  	\`github_number\` numeric,
  	\`github_id\` numeric,
  	\`repo_id\` integer NOT NULL,
  	\`linear_data_number\` numeric,
  	\`linear_data_starts_at\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`repo_id\`) REFERENCES \`repos\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`milestones_local_id_idx\` ON \`milestones\` (\`local_id\`);`)
  await db.run(sql`CREATE INDEX \`milestones_state_idx\` ON \`milestones\` (\`state\`);`)
  await db.run(sql`CREATE INDEX \`milestones_github_number_idx\` ON \`milestones\` (\`github_number\`);`)
  await db.run(sql`CREATE INDEX \`milestones_github_id_idx\` ON \`milestones\` (\`github_id\`);`)
  await db.run(sql`CREATE INDEX \`milestones_repo_idx\` ON \`milestones\` (\`repo_id\`);`)
  await db.run(sql`CREATE INDEX \`milestones_updated_at_idx\` ON \`milestones\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`milestones_created_at_idx\` ON \`milestones\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`sync_events\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`event_type\` text NOT NULL,
  	\`direction\` text NOT NULL,
  	\`status\` text DEFAULT 'pending' NOT NULL,
  	\`payload\` text,
  	\`error\` text,
  	\`conflict_resolution\` text,
  	\`repo_id\` integer NOT NULL,
  	\`issue_id\` integer,
  	\`milestone_id\` integer,
  	\`processed_at\` text,
  	\`retry_count\` numeric DEFAULT 0,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`repo_id\`) REFERENCES \`repos\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`issue_id\`) REFERENCES \`issues\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`milestone_id\`) REFERENCES \`milestones\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`sync_events_event_type_idx\` ON \`sync_events\` (\`event_type\`);`)
  await db.run(sql`CREATE INDEX \`sync_events_status_idx\` ON \`sync_events\` (\`status\`);`)
  await db.run(sql`CREATE INDEX \`sync_events_repo_idx\` ON \`sync_events\` (\`repo_id\`);`)
  await db.run(sql`CREATE INDEX \`sync_events_issue_idx\` ON \`sync_events\` (\`issue_id\`);`)
  await db.run(sql`CREATE INDEX \`sync_events_milestone_idx\` ON \`sync_events\` (\`milestone_id\`);`)
  await db.run(sql`CREATE INDEX \`sync_events_updated_at_idx\` ON \`sync_events\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`sync_events_created_at_idx\` ON \`sync_events\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`linear_integrations\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`user_id\` integer NOT NULL,
  	\`repo_id\` integer,
  	\`linear_data_organization_id\` text NOT NULL,
  	\`linear_data_organization_name\` text NOT NULL,
  	\`linear_data_url_key\` text,
  	\`linear_data_user_id\` text,
  	\`linear_data_user_email\` text,
  	\`linear_data_team_id\` text,
  	\`linear_data_team_name\` text,
  	\`webhook_id\` text,
  	\`webhook_secret\` text,
  	\`active\` integer DEFAULT true,
  	\`last_sync_at\` text,
  	\`last_sync_result\` text,
  	\`sync_settings_auto_sync\` integer DEFAULT true,
  	\`sync_settings_sync_cycles\` integer DEFAULT true,
  	\`sync_settings_sync_projects\` integer DEFAULT true,
  	\`sync_settings_sync_labels\` integer DEFAULT true,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`repo_id\`) REFERENCES \`repos\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`linear_integrations_user_idx\` ON \`linear_integrations\` (\`user_id\`);`)
  await db.run(sql`CREATE INDEX \`linear_integrations_repo_idx\` ON \`linear_integrations\` (\`repo_id\`);`)
  await db.run(sql`CREATE INDEX \`linear_integrations_linear_data_linear_data_organization_idx\` ON \`linear_integrations\` (\`linear_data_organization_id\`);`)
  await db.run(sql`CREATE INDEX \`linear_integrations_linear_data_linear_data_team_id_idx\` ON \`linear_integrations\` (\`linear_data_team_id\`);`)
  await db.run(sql`CREATE INDEX \`linear_integrations_webhook_id_idx\` ON \`linear_integrations\` (\`webhook_id\`);`)
  await db.run(sql`CREATE INDEX \`linear_integrations_active_idx\` ON \`linear_integrations\` (\`active\`);`)
  await db.run(sql`CREATE INDEX \`linear_integrations_updated_at_idx\` ON \`linear_integrations\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`linear_integrations_created_at_idx\` ON \`linear_integrations\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_kv\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`data\` text NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`payload_kv_key_idx\` ON \`payload_kv\` (\`key\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`global_slug\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_global_slug_idx\` ON \`payload_locked_documents\` (\`global_slug\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_updated_at_idx\` ON \`payload_locked_documents\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_created_at_idx\` ON \`payload_locked_documents\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	\`media_id\` integer,
  	\`installations_id\` integer,
  	\`repos_id\` integer,
  	\`issues_id\` integer,
  	\`milestones_id\` integer,
  	\`sync_events_id\` integer,
  	\`linear_integrations_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`installations_id\`) REFERENCES \`installations\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`repos_id\`) REFERENCES \`repos\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`issues_id\`) REFERENCES \`issues\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`milestones_id\`) REFERENCES \`milestones\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`sync_events_id\`) REFERENCES \`sync_events\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`linear_integrations_id\`) REFERENCES \`linear_integrations\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_installations_id_idx\` ON \`payload_locked_documents_rels\` (\`installations_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_repos_id_idx\` ON \`payload_locked_documents_rels\` (\`repos_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_issues_id_idx\` ON \`payload_locked_documents_rels\` (\`issues_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_milestones_id_idx\` ON \`payload_locked_documents_rels\` (\`milestones_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_sync_events_id_idx\` ON \`payload_locked_documents_rels\` (\`sync_events_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_linear_integrations_id_idx\` ON \`payload_locked_documents_rels\` (\`linear_integrations_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`value\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_key_idx\` ON \`payload_preferences\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_updated_at_idx\` ON \`payload_preferences\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_created_at_idx\` ON \`payload_preferences\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_preferences\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_order_idx\` ON \`payload_preferences_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_parent_idx\` ON \`payload_preferences_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_path_idx\` ON \`payload_preferences_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_users_id_idx\` ON \`payload_preferences_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_migrations\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`batch\` numeric,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_migrations_updated_at_idx\` ON \`payload_migrations\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_migrations_created_at_idx\` ON \`payload_migrations\` (\`created_at\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`users_roles\`;`)
  await db.run(sql`DROP TABLE \`users_sessions\`;`)
  await db.run(sql`DROP TABLE \`users\`;`)
  await db.run(sql`DROP TABLE \`media\`;`)
  await db.run(sql`DROP TABLE \`installations\`;`)
  await db.run(sql`DROP TABLE \`installations_rels\`;`)
  await db.run(sql`DROP TABLE \`repos\`;`)
  await db.run(sql`DROP TABLE \`issues\`;`)
  await db.run(sql`DROP TABLE \`issues_rels\`;`)
  await db.run(sql`DROP TABLE \`milestones\`;`)
  await db.run(sql`DROP TABLE \`sync_events\`;`)
  await db.run(sql`DROP TABLE \`linear_integrations\`;`)
  await db.run(sql`DROP TABLE \`payload_kv\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_migrations\`;`)
}
