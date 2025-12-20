import { beforeAll, afterAll } from 'vitest'
import { cleanupAllWorktrees } from './helpers/worktree'

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
