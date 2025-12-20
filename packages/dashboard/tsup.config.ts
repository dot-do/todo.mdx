import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'components/index': 'src/components/index.ts',
    'routes/index': 'src/routes/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'esnext',
  sourcemap: true,
  external: ['react', 'react-dom', 'next', '@xterm/xterm/css/xterm.css'],
  banner: {
    js: '"use client";',
  },
  esbuildOptions(options) {
    options.jsx = 'automatic'
  },
})
