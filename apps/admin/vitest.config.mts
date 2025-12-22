import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    // Use node environment for unit tests (not jsdom)
    // jsdom causes issues with wrangler/esbuild dependencies
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      // Unit tests - pure functions, no Payload dependencies
      'src/**/*.test.ts',
      'tests/unit/**/*.test.ts',
    ],
    exclude: [
      // Integration tests need special setup (Payload + wrangler)
      'tests/int/**/*.int.spec.ts',
      'node_modules',
    ],
  },
})
