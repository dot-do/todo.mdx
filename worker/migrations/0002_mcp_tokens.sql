-- MCP OAuth 2.1 token storage

-- Authorization codes (short-lived, ~10 minutes)
CREATE TABLE IF NOT EXISTS mcp_auth_codes (
  code TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT,
  code_challenge_method TEXT,
  scope TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for cleanup of expired codes
CREATE INDEX IF NOT EXISTS idx_mcp_auth_codes_expires ON mcp_auth_codes(expires_at);

-- Access tokens (longer-lived, ~1 hour)
CREATE TABLE IF NOT EXISTS mcp_access_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_mcp_access_tokens_expires ON mcp_access_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_mcp_access_tokens_user ON mcp_access_tokens(user_id);
