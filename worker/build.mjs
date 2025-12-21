#!/usr/bin/env node
/**
 * Custom build script for the worker
 *
 * This adds the import.meta.url polyfill at the top of the bundle,
 * which is required for Payload CMS to work in Cloudflare Workers.
 *
 * Based on OpenNext's approach:
 * https://github.com/opennextjs/opennextjs-cloudflare
 */

import * as esbuild from 'esbuild'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Banner code to run before any imports
// This polyfills import.meta.url for packages that rely on it (like Payload)
const banner = `
// Polyfill import.meta.url for packages that rely on it (Payload CMS, etc.)
// Must be at the very top before any imports
import.meta.url ??= "file:///worker.js";
globalThis.__dirname ??= "";
globalThis.__filename ??= "";
`

async function build() {
  const isWatch = process.argv.includes('--watch')

  try {
    const config = {
      entryPoints: [resolve(__dirname, 'src/index.ts')],
      bundle: true,
      outfile: resolve(__dirname, 'dist/index.js'),
      format: 'esm',
      platform: 'neutral',  // Neutral platform for Workers
      target: 'esnext',
      minify: !isWatch,
      sourcemap: true,
      metafile: true,
      banner: {
        js: banner,
      },
      // Mark cloudflare and node builtins as external
      // Workers with nodejs_compat provides these at runtime
      external: [
        'cloudflare:*',
        'node:*',
        'fs',
        'fs/promises',
        'path',
        'crypto',
        'url',
        'module',
        'stream',
        'stream/web',
        'os',
        'util',
        'buffer',
        'events',
        'child_process',
        'http',
        'https',
        'net',
        'tls',
        'dns',
        'readline',
        'process',
        'assert',
        'async_hooks',
        'perf_hooks',
        'string_decoder',
        'zlib',
        'worker_threads',
        'querystring',
        'tty',
        'constants',
        'vm',
        'v8',
        'domain',
        'dgram',
        'inspector',
        'trace_events',
        'wasi',
        'diagnostics_channel',
        'cluster',
        'repl',
        'punycode',
        'timers',
        'timers/promises',
      ],
      // Alias for problematic packages
      alias: {
        'file-type': resolve(__dirname, 'shims/file-type.js'),
        'undici': resolve(__dirname, 'shims/undici.js'),
        // Map buffer to Workers native Buffer
        'buffer': resolve(__dirname, 'shims/buffer.js'),
        'buffer/index.js': resolve(__dirname, 'shims/buffer.js'),
      },
      // Node compatibility
      define: {
        'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
      },
      conditions: ['workerd', 'worker', 'browser', 'module', 'import', 'require'],
      mainFields: ['workerd', 'worker', 'browser', 'module', 'main'],
    }

    if (isWatch) {
      const ctx = await esbuild.context(config)
      await ctx.watch()
      console.log('[build] Watching for changes...')
    } else {
      const result = await esbuild.build(config)
      console.log('[build] Build complete')

      if (result.metafile) {
        const text = await esbuild.analyzeMetafile(result.metafile)
        console.log(text)
      }
    }
  } catch (error) {
    console.error('[build] Build failed:', error)
    process.exit(1)
  }
}

build()
