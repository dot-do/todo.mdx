import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    local: 'src/local.ts',
    cloud: 'src/cloud.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
})
