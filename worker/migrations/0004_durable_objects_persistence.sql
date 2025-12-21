-- Durable Objects persistence and observability tables
--
-- Apply with: wrangler d1 migrations apply todo-mdx --local (for dev) or --remote (for prod)
-- This migration adds tables for:
-- 1. durable_objects - Track DO state snapshots and heartbeats
-- 2. tool_executions - Log MCP tool calls for observability
-- 3. connections - Unified integration connections (GitHub, Slack, Linear)

-- Track DO state and metadata for debugging/recovery
CREATE TABLE IF NOT EXISTS durable_objects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  do_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,  -- 'org' | 'repo' | 'project' | 'pr' | 'issue'
  ref TEXT NOT NULL,   -- Human-readable reference: owner/repo#123
  state TEXT,          -- XState snapshot (JSON)
  last_heartbeat TEXT, -- Last state update (ISO datetime)
  org_id INTEGER,      -- FK to installations (optional)
  repo_id INTEGER,     -- FK to repos (optional)
  issue_id INTEGER,    -- External issue reference (optional)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Tool execution logs for MCP observability
CREATE TABLE IF NOT EXISTS tool_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  do_id TEXT NOT NULL,        -- Which DO executed this tool
  tool TEXT NOT NULL,         -- Tool name
  params TEXT,                -- Tool parameters (JSON)
  result TEXT,                -- Tool result (JSON)
  error TEXT,                 -- Error message if failed
  duration_ms INTEGER,        -- Execution duration
  user_id TEXT,               -- User who triggered (optional)
  connection_id TEXT,         -- Connection ID for integrations (optional)
  executed_at TEXT NOT NULL,  -- ISO datetime
  created_at TEXT NOT NULL
);

-- Connections table for unified integrations
CREATE TABLE IF NOT EXISTS connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,      -- WorkOS user ID
  org_id INTEGER,             -- FK to installations (optional)
  app TEXT NOT NULL,          -- Integration name: 'GitHub', 'Slack', 'Linear'
  provider TEXT NOT NULL,     -- 'native' | 'composio'
  external_id TEXT NOT NULL,  -- Provider-specific ID
  external_ref TEXT,          -- Provider metadata (JSON)
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'expired' | 'revoked'
  scopes TEXT,                -- Granted permissions (JSON array)
  connected_at TEXT NOT NULL, -- ISO datetime
  expires_at TEXT,            -- Token expiration (ISO datetime)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_durable_objects_do_id ON durable_objects(do_id);
CREATE INDEX IF NOT EXISTS idx_durable_objects_type ON durable_objects(type);
CREATE INDEX IF NOT EXISTS idx_durable_objects_ref ON durable_objects(ref);
CREATE INDEX IF NOT EXISTS idx_durable_objects_last_heartbeat ON durable_objects(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_durable_objects_org_id ON durable_objects(org_id);
CREATE INDEX IF NOT EXISTS idx_durable_objects_repo_id ON durable_objects(repo_id);

CREATE INDEX IF NOT EXISTS idx_tool_executions_do_id ON tool_executions(do_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool ON tool_executions(tool);
CREATE INDEX IF NOT EXISTS idx_tool_executions_executed_at ON tool_executions(executed_at);
CREATE INDEX IF NOT EXISTS idx_tool_executions_user_id ON tool_executions(user_id);

CREATE INDEX IF NOT EXISTS idx_connections_user_id ON connections(user_id);
CREATE INDEX IF NOT EXISTS idx_connections_app ON connections(app);
CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(status);
CREATE INDEX IF NOT EXISTS idx_connections_external_id ON connections(external_id);
