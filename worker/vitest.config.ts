import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      'cloudflare:workers': new URL('./src/__mocks__/cloudflare-workers.ts', import.meta.url).pathname,
    },
  },
})
