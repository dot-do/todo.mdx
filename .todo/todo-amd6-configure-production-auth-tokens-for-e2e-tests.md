---
id: todo-amd6
title: "Configure production auth tokens for E2E tests"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-21T04:47:58.180Z"
updatedAt: "2025-12-21T05:33:33.722Z"
closedAt: "2025-12-21T05:33:33.722Z"
source: "beads"
---

# Configure production auth tokens for E2E tests

Create and configure authentication tokens for E2E tests to access production APIs.

## Required tokens
- `WORKER_ACCESS_TOKEN` - Bearer token for worker API authentication
- `MCP_ACCESS_TOKEN` - Token for MCP tool calls

## Implementation options
1. Create dedicated E2E test user with API key in KV
2. Use OAuth flow to generate long-lived tokens
3. Create test-only endpoint with different auth

## Security considerations
- Tokens should have limited scope (test repo only)
- Store in GitHub Actions secrets for CI
- Document in .env.example

### Related Issues

**Depends on:**
- **todo-8dmr**

**Blocks:**
- **todo-9i3u**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
