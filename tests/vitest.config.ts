import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    root: __dirname,
    include: ['e2e/**/*.test.ts'],
    globals: true,
    testTimeout: 60000, // E2E tests need longer timeouts
    hookTimeout: 30000,
    setupFiles: ['./setup.ts'],
    // Run E2E tests sequentially to avoid race conditions
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Environment variables for tests
    env: {
      FIXTURES_DIR: path.join(__dirname, 'fixtures'),
    },
  },
})
