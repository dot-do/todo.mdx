import { defineConfig } from 'tsup'

export default defineConfig([
  // Main library exports
  {
    entry: {
      index: 'src/index.ts',
      components: 'src/components.tsx',
    },
    format: ['esm'],
    dts: true,
    clean: true,
    target: 'node20',
    sourcemap: true,
    external: ['react', 'react-reconciler'],
  },
  // CLI binary with shebang
  {
    entry: {
      cli: 'src/cli.ts',
    },
    format: ['esm'],
    dts: true,
    target: 'node20',
    sourcemap: true,
    external: ['react', 'react-reconciler'],
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
])
