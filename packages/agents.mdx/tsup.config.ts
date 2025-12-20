import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    local: 'src/local.ts',
    cloud: 'src/cloud.ts',
    cli: 'src/cli.ts',
    auth: 'src/auth.ts',
    'cloudflare-workflows': 'src/cloudflare-workflows.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  shims: true, // Add Node.js shims for __dirname, etc
})
