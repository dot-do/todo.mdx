-- MCP OAuth state storage for WorkOS AuthKit integration

-- OAuth state for tracking the authorization flow
-- Stores client OAuth parameters during WorkOS authentication
CREATE TABLE IF NOT EXISTS mcp_oauth_state (
  state_id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  scope TEXT NOT NULL,
  client_state TEXT,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for cleanup of expired state
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_state_expires ON mcp_oauth_state(expires_at);
