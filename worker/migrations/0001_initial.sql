-- D1 Schema: App installs and Durable Object registry

-- GitHub App installations
CREATE TABLE IF NOT EXISTS installations (
  id INTEGER PRIMARY KEY,
  installation_id INTEGER NOT NULL UNIQUE,
  account_type TEXT NOT NULL,
  account_id INTEGER NOT NULL,
  account_login TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  suspended_at TEXT
);

-- Repos being synced (Durable Object instances)
CREATE TABLE IF NOT EXISTS repos (
  id INTEGER PRIMARY KEY,
  installation_id INTEGER NOT NULL,
  repo_id INTEGER NOT NULL UNIQUE,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  do_id TEXT NOT NULL,
  sync_enabled INTEGER NOT NULL DEFAULT 1,
  last_sync_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- GitHub Projects being synced (Durable Object instances)
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY,
  installation_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL UNIQUE,
  project_number INTEGER NOT NULL,
  owner TEXT NOT NULL,
  title TEXT NOT NULL,
  do_id TEXT NOT NULL,
  sync_enabled INTEGER NOT NULL DEFAULT 1,
  last_sync_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Repo <-> Project associations
CREATE TABLE IF NOT EXISTS repo_projects (
  id INTEGER PRIMARY KEY,
  repo_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_repos_installation ON repos(installation_id);
CREATE INDEX IF NOT EXISTS idx_repos_full_name ON repos(full_name);
CREATE INDEX IF NOT EXISTS idx_projects_installation ON projects(installation_id);
CREATE INDEX IF NOT EXISTS idx_repo_projects_repo ON repo_projects(repo_id);
CREATE INDEX IF NOT EXISTS idx_repo_projects_project ON repo_projects(project_id);
