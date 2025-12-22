import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      // Ensure React is resolved from tests/node_modules to avoid version conflicts
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      // Mock Cloudflare Workers runtime for tests
      'cloudflare:workers': path.resolve(__dirname, '../worker/src/__mocks__/cloudflare-workers.ts'),
    },
  },
  test: {
    root: __dirname,
    include: ['unit/**/*.test.{ts,tsx}', 'e2e/**/*.test.{ts,tsx}'],
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
