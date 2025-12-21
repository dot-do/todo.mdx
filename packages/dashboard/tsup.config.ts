import { defineConfig } from 'tsup'

export default defineConfig([
  // Main index (re-exports everything, no 'use client' on entry)
  {
    entry: {
      index: 'src/index.ts',
    },
    format: ['esm'],
    dts: true,
    clean: true,
    target: 'esnext',
    sourcemap: true,
    external: ['react', 'react-dom', 'next', '@xterm/xterm/css/xterm.css'],
    esbuildOptions(options) {
      options.jsx = 'automatic'
    },
  },
  // Client bundles (routes and components - need 'use client' banner)
  {
    entry: {
      'routes/index': 'src/routes/index.ts',
      'components/index': 'src/components/index.ts',
    },
    format: ['esm'],
    dts: true,
    target: 'esnext',
    sourcemap: true,
    external: ['react', 'react-dom', 'next', '@xterm/xterm/css/xterm.css'],
    banner: {
      js: '"use client";',
    },
    esbuildOptions(options) {
      options.jsx = 'automatic'
    },
  },
])
