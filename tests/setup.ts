import { beforeAll, afterAll } from 'vitest'
import { config } from 'dotenv'
import { resolve } from 'path'
import { cleanupAllWorktrees } from './helpers/worktree'
import { hasWorkerCredentials } from './helpers/worker'

// Load .env from project root
config({ path: resolve(__dirname, '../.env') })

// Global test setup
beforeAll(async () => {
  // Verify submodule is initialized
  const fixturesDir = process.env.FIXTURES_DIR
  if (!fixturesDir) {
    throw new Error('FIXTURES_DIR not set')
  }

  // Check for GitHub credentials (optional - tests can skip if not set)
  const hasGitHubCredentials = !!(
    process.env.GITHUB_APP_ID &&
    process.env.GITHUB_PRIVATE_KEY &&
    process.env.GITHUB_INSTALLATION_ID
  )

  if (!hasGitHubCredentials) {
    console.warn(
      '\n⚠️  GitHub App credentials not configured.\n' +
        '   Set GITHUB_APP_ID, GITHUB_PRIVATE_KEY, and GITHUB_INSTALLATION_ID\n' +
        '   to run GitHub integration tests.\n' +
        '   Skipping tests that require GitHub access.\n'
    )
  }

  // Check for worker API key
  if (!hasWorkerCredentials()) {
    console.warn(
      '\n⚠️  TEST_API_KEY not configured.\n' +
        '   Set TEST_API_KEY to run worker API tests.\n' +
        '   Skipping tests that require worker API access.\n'
    )
  }
})

// Global cleanup
afterAll(async () => {
  // Clean up any leftover worktrees
  await cleanupAllWorktrees()
})

// Export flag for tests to check
export const hasGitHubCredentials = !!(
  process.env.GITHUB_APP_ID &&
  process.env.GITHUB_PRIVATE_KEY &&
  process.env.GITHUB_INSTALLATION_ID
)
