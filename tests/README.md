# E2E Test Suite

End-to-end tests for todo.mdx, covering worker API, GitHub sync, Linear integration, MCP server, and workflow execution.

## Setup

### 1. Install Dependencies

From the repository root:

```bash
pnpm install
```

### 2. Configure Environment

Copy the example environment file and fill in your credentials:

```bash
cd tests
cp .env.example .env
```

Edit `.env` with your actual credentials (see [Environment Variables](#environment-variables) below).

### 3. Run Tests

```bash
# Run all E2E tests
pnpm --filter @todo.mdx/tests test

# Run specific test file
pnpm --filter @todo.mdx/tests test -- e2e/github-sync.test.ts

# Run tests in watch mode
pnpm --filter @todo.mdx/tests test:watch

# Run only tests matching a pattern
pnpm --filter @todo.mdx/tests test -- -t "GitHub sync"
```

## Environment Variables

### Required Variables

These variables are required for most tests to run:

#### `WORKER_BASE_URL`
- **Required for**: Worker API tests, webhook tests, sync tests
- **Description**: Base URL of the deployed todo.mdx worker
- **Example**: `https://todo.mdx.do`
- **Default**: `http://localhost:8787` (local development)

#### `WORKER_ACCESS_TOKEN`
- **Required for**: Authenticated worker API calls
- **Description**: Bearer token for authenticating with the worker API
- **How to obtain**:
  - Via WorkOS AuthKit OAuth flow
  - Generate in admin dashboard (if implemented)
  - For development, can be obtained from WorkOS dashboard

### GitHub Integration Variables

Required for GitHub sync tests (`github-sync.test.ts`, `beads-sync-roundtrip.test.ts`):

#### `GITHUB_APP_ID`
- **Description**: GitHub App ID
- **How to obtain**:
  1. Go to https://github.com/settings/apps
  2. Select your GitHub App
  3. Copy the App ID from the "About" section

#### `GITHUB_PRIVATE_KEY`
- **Description**: GitHub App private key (PEM format or base64 encoded)
- **How to obtain**:
  1. In GitHub App settings, scroll to "Private keys"
  2. Click "Generate a private key"
  3. Copy the contents of the downloaded `.pem` file
  4. Either paste the PEM directly or base64 encode it

#### `GITHUB_INSTALLATION_ID`
- **Description**: Installation ID for the test repository
- **How to obtain**:
  1. Install the GitHub App on your test repository (dot-do/test.mdx)
  2. Navigate to the installation settings
  3. The installation ID is in the URL: `https://github.com/settings/installations/{installation_id}`

#### `GITHUB_WEBHOOK_SECRET`
- **Description**: Webhook secret for validating GitHub webhook signatures
- **How to obtain**:
  1. In GitHub App settings, scroll to "Webhook"
  2. Set or retrieve the webhook secret

### MCP Server Variables

Required for MCP tests (`mcp-server.test.ts`):

#### `MCP_BASE_URL`
- **Description**: Base URL for the MCP server (usually same as `WORKER_BASE_URL`)
- **Example**: `https://todo.mdx.do`

#### `MCP_ACCESS_TOKEN`
- **Description**: OAuth 2.1 access token for MCP server
- **How to obtain**:
  - Via `oauth.do` CLI tool
  - Complete the OAuth 2.1 + PKCE flow with WorkOS AuthKit
  - Token is cached in oauth.do storage after successful authentication

### Linear Integration Variables (Optional)

Required only for Linear integration tests (`linear-integration.test.ts`):

#### `LINEAR_API_KEY`
- **Description**: Linear API key for test workspace
- **How to obtain**:
  1. Go to https://linear.app/settings/api
  2. Create a new API key
  3. Select appropriate scopes (read/write issues)

#### `LINEAR_TEAM_ID`
- **Description**: Linear team ID for creating test issues
- **How to obtain**:
  - Find in Linear team settings URL
  - Or query via Linear GraphQL API: `query { teams { nodes { id name } } }`

### Optional Variables

#### `SITE_BASE_URL`
- **Description**: Base URL for the main todo.mdx site
- **Default**: `https://todo.mdx.do`

#### `ADMIN_BASE_URL`
- **Description**: Base URL for the Payload admin dashboard
- **Default**: `https://admin.mdx.do`

#### `FIXTURES_DIR`
- **Description**: Directory containing test fixtures and MDX files
- **Default**: `./fixtures/test.mdx`

## Test Organization

### Test Files

- **`site.test.ts`**: Tests for main site endpoints (docs, dashboard)
- **`admin-site.test.ts`**: Tests for Payload CMS admin site
- **`github-sync.test.ts`**: GitHub issue sync (beads → GitHub)
- **`beads-sync-roundtrip.test.ts`**: Bidirectional sync (beads ↔ GitHub)
- **`milestones-sync.test.ts`**: GitHub milestone sync
- **`linear-integration.test.ts`**: Linear workspace integration
- **`mcp-server.test.ts`**: MCP server tools and resources
- **`webhook-signature.test.ts`**: GitHub webhook signature validation
- **`workflow-execution.test.ts`**: Workflow triggers and execution
- **`beads-workflow.test.ts`**: Beads CLI workflow tests
- **`claude-sandbox.test.ts`**: Claude Code sandbox integration
- **`stdio-sandbox.test.ts`**: STDIO MCP transport tests
- **`slack-notifications.test.ts`**: Slack notification integration

### Helper Modules

Located in `tests/helpers/`:

- **`worker.ts`**: Worker API client (repos, webhooks, sync, workflows)
- **`github.ts`**: GitHub API client (Octokit wrapper)
- **`beads.ts`**: Beads CLI wrapper
- **`worktree.ts`**: Git worktree management for isolated test environments

## Test Patterns

### Skipping Tests Without Credentials

Tests automatically skip if required credentials are missing:

```typescript
import { hasGitHubCredentials } from '../helpers/github'

const describeWithGitHub = hasGitHubCredentials() ? describe : describe.skip

describeWithGitHub('GitHub sync', () => {
  // Tests only run if GitHub credentials are configured
})
```

### Using Git Worktrees

Tests that need isolated git environments use worktrees:

```typescript
import { createTestWorktree } from '../helpers/worktree'

let worktree: Worktree

beforeEach(async () => {
  worktree = await createTestWorktree('test-name')
})

afterEach(async () => {
  await worktree.cleanup()
})
```

### Cleanup

Tests should clean up remote resources (GitHub issues, branches, etc.) in `afterEach` hooks:

```typescript
afterEach(async () => {
  try {
    await github.deleteRemoteBranch(worktree.branch)
  } catch {
    // Ignore cleanup errors
  }
  await worktree.cleanup()
})
```

## CI/CD Integration

### GitHub Actions

To run E2E tests in CI, configure repository secrets:

```yaml
env:
  WORKER_BASE_URL: ${{ secrets.WORKER_BASE_URL }}
  WORKER_ACCESS_TOKEN: ${{ secrets.WORKER_ACCESS_TOKEN }}
  MCP_BASE_URL: ${{ secrets.MCP_BASE_URL }}
  MCP_ACCESS_TOKEN: ${{ secrets.MCP_ACCESS_TOKEN }}
  GITHUB_APP_ID: ${{ secrets.E2E_GITHUB_APP_ID }}
  GITHUB_PRIVATE_KEY: ${{ secrets.E2E_GITHUB_PRIVATE_KEY }}
  GITHUB_INSTALLATION_ID: ${{ secrets.E2E_GITHUB_INSTALLATION_ID }}
  GITHUB_WEBHOOK_SECRET: ${{ secrets.E2E_GITHUB_WEBHOOK_SECRET }}
  LINEAR_API_KEY: ${{ secrets.E2E_LINEAR_API_KEY }}
  LINEAR_TEAM_ID: ${{ secrets.E2E_LINEAR_TEAM_ID }}
```

### Selective Test Execution

Use environment variables to control which tests run:

- If GitHub credentials are missing, GitHub tests are skipped
- If Linear credentials are missing, Linear tests are skipped
- If worker credentials are missing, most API tests are skipped

## Troubleshooting

### "Skipping tests - no credentials configured"

Tests are skipped when required environment variables are missing. Check:
1. `.env` file exists in `tests/` directory
2. Variables are set correctly (no trailing spaces, proper format)
3. Run from repository root or use `pnpm --filter` to ensure correct working directory

### "ECONNREFUSED localhost:8787"

Tests are trying to connect to local worker but none is running. Either:
1. Set `WORKER_BASE_URL=https://todo.mdx.do` to use production
2. Start local worker: `cd worker && pnpm dev`

### GitHub authentication failures

Check:
1. GitHub App private key is valid (PEM format or base64)
2. Installation ID is correct for test repository
3. App has necessary permissions (issues, contents, pull requests)

### MCP token expired

MCP tokens may expire. Re-authenticate:
```bash
# Use oauth.do CLI to refresh token
npx oauth.do auth
```

### Linear API rate limiting

Linear API has rate limits. If tests fail due to rate limiting:
1. Reduce test frequency
2. Use separate API key for CI
3. Add delays between Linear API calls

## Development

### Adding New Tests

1. Create test file in `tests/e2e/`
2. Import necessary helpers from `tests/helpers/`
3. Use conditional `describe` for tests requiring credentials
4. Clean up resources in `afterEach` hooks
5. Update this README if new environment variables are needed

### Debugging Tests

Run with verbose output:

```bash
# Show console logs and detailed output
pnpm --filter @todo.mdx/tests test -- --reporter=verbose

# Run single test with debugging
pnpm --filter @todo.mdx/tests test -- -t "specific test name" --reporter=verbose
```

## Architecture Notes

### Worker API Design

The worker exposes several API surfaces:
- **REST API** (`/api/*`): CRUD operations for repos, issues, milestones
- **Webhooks** (`/github/webhook`): GitHub webhook receiver
- **MCP Server** (`/mcp/*`): Model Context Protocol server with OAuth 2.1
- **Durable Objects** (`/api/repos/:owner/:repo/do/*`): Per-repo sync coordination

### Sync Flow

1. **GitHub → Worker**: Webhooks trigger sync via Durable Objects
2. **Worker → D1**: Data persisted in Cloudflare D1 (SQLite)
3. **Worker → Beads**: MCP server exposes beads operations
4. **Beads → GitHub**: `bd sync` pushes changes via Worker API

### Test Repository

Tests use `dot-do/test.mdx` as a dedicated test repository:
- Submodule at `tests/fixtures/test.mdx`
- Tests create temporary worktrees from this submodule
- Remote branches are created/deleted during tests
- Real GitHub issues may be created (and should be cleaned up)
