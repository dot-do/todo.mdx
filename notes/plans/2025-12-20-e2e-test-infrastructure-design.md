# E2E Test Infrastructure Design

## Overview

E2E test suite for todo.mdx that tests real integrations: GitHub, beads sync, and Worker/MCP server.

## Directory Structure

```
tests/
├── vitest.config.ts            # E2E test configuration
├── setup.ts                    # Global test setup (GitHub App auth)
├── helpers/
│   ├── github.ts               # GitHub API helpers (App auth, PR creation)
│   ├── worktree.ts             # Git worktree management
│   └── beads.ts                # Beads CLI helpers
├── e2e/
│   ├── github-sync.test.ts     # GitHub Issues <-> beads sync
│   ├── beads-workflow.test.ts  # bd create -> bd update -> bd close
│   └── mcp-server.test.ts      # Worker MCP server tests
└── fixtures/
    └── test.mdx/               # Git submodule (real repo for testing)
```

## Test Isolation via Git Worktrees

Each test that needs isolation creates a worktree from the test.mdx submodule:

```typescript
export async function createTestWorktree(testName: string): Promise<Worktree> {
  const branchName = `test/${testName}-${randomId()}`
  const worktreePath = path.join(FIXTURES_DIR, '.worktrees', branchName)

  await exec(`git worktree add -b ${branchName} ${worktreePath}`)

  return {
    path: worktreePath,
    branch: branchName,
    cleanup: () => exec(`git worktree remove ${worktreePath} --force`)
  }
}
```

Benefits:
- **Fast**: Shares git objects, no network clone
- **Real branches**: Can push to GitHub, open PRs
- **Isolated**: Each test has its own working tree
- **Clean**: `git worktree remove` cleans up

## GitHub App Authentication

Tests use a GitHub App for secure, scoped access:

**Required permissions:**
- Issues: Read & Write
- Contents: Read & Write
- Pull requests: Read & Write

**Environment variables:**
- `GITHUB_APP_ID`
- `GITHUB_PRIVATE_KEY`
- `GITHUB_INSTALLATION_ID`

Tests skip gracefully if credentials aren't set (for local dev without auth).

## Test Cases

### github-sync.test.ts
- `bd create` -> pushes -> creates GitHub issue
- `bd update` -> pushes -> updates GitHub issue
- `bd close` -> pushes -> closes GitHub issue
- GitHub issue created -> webhook -> creates beads issue
- PR merged -> issues closed in commit message get closed

### beads-workflow.test.ts
- `bd init` creates .beads directory
- `bd create` with dependencies
- `bd ready` filters blocked issues
- `bd dep add` creates blocking relationship
- `bd sync` pushes to remote

### mcp-server.test.ts
- `list_issues` returns issues from repo
- `create_issue` creates via API
- `update_issue` status change

## Dependencies

```json
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "@octokit/app": "^14.0.0",
    "execa": "^9.0.0"
  }
}
```

## Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run with GitHub integration (requires App credentials)
GITHUB_APP_ID=xxx GITHUB_PRIVATE_KEY=xxx pnpm test:e2e

# Run specific test file
pnpm test:e2e github-sync
```
