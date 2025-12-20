import { defineConfig } from 'tsup'

export default defineConfig([
  // Main library
  {
    entry: {
      index: 'src/index.ts',
      protocol: 'src/protocol.ts',
      server: 'src/server.ts',
      client: 'src/client.ts',
    },
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
  },
  // CLI with shebang
  {
    entry: {
      cli: 'src/cli.ts',
    },
    format: ['esm'],
    dts: false,
    sourcemap: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
])
