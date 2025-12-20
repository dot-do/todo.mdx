import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
    docs: 'src/docs.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node20',
  sourcemap: true,
})
