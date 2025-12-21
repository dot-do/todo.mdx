#!/usr/bin/env node
/**
 * Post-build script to add PayloadRPC entrypoint to the OpenNext worker
 *
 * This appends a WorkerEntrypoint class that exposes Payload's REST API
 * with a special internal header to bypass access control.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const workerPath = join(__dirname, '../.open-next/worker.js')

if (!existsSync(workerPath)) {
  console.error('Error: .open-next/worker.js not found. Run build first.')
  process.exit(1)
}

// Read existing worker.js
let workerCode = readFileSync(workerPath, 'utf-8')

// Check if PayloadRPC is already added
if (workerCode.includes('export class PayloadRPC')) {
  console.log('PayloadRPC already exists in worker.js, skipping.')
  process.exit(0)
}

// PayloadRPC code to append
// Uses internal fetch to the same worker's API with special header
const payloadRpcCode = `

// ============================================
// PayloadRPC - Workers RPC entrypoint for Payload CMS
// Added by scripts/add-payload-rpc.mjs
//
// Uses internal HTTP calls to /api with X-Payload-Internal header
// to bypass access control.
// ============================================

import { WorkerEntrypoint } from 'cloudflare:workers';

export class PayloadRPC extends WorkerEntrypoint {
  async _fetch(path, options = {}) {
    // Use public URL since self-reference binding has initialization issues
    const baseUrl = 'https://admin-todo-mdx.dotdo.workers.dev';
    const url = new URL(path, baseUrl);
    console.log(\`[PayloadRPC] \${options.method || 'GET'} \${url.pathname}\`);
    const response = await fetch(url.toString(), {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Payload-Internal': 'true',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) {
      const text = await response.text();
      console.error(\`[PayloadRPC] Error: \${response.status} \${text}\`);
      throw new Error(\`Payload API error: \${response.status} \${text}\`);
    }
    return response.json();
  }

  async find(args) {
    const params = new URLSearchParams();
    if (args.where) params.set('where', JSON.stringify(args.where));
    if (args.limit) params.set('limit', String(args.limit));
    if (args.depth !== undefined) params.set('depth', String(args.depth));
    if (args.sort) params.set('sort', args.sort);

    const queryString = params.toString();
    const path = \`/api/\${args.collection}\${queryString ? '?' + queryString : ''}\`;
    return this._fetch(path);
  }

  async findByID(args) {
    const params = new URLSearchParams();
    if (args.depth !== undefined) params.set('depth', String(args.depth));

    const queryString = params.toString();
    const path = \`/api/\${args.collection}/\${args.id}\${queryString ? '?' + queryString : ''}\`;
    // findByID returns the doc directly from the API
    return this._fetch(path);
  }

  async create(args) {
    // Payload API returns {doc, message} - extract doc to match local API behavior
    const result = await this._fetch(\`/api/\${args.collection}\`, {
      method: 'POST',
      body: args.data,
    });
    return result.doc;
  }

  async update(args) {
    // Payload API returns {doc, message} - extract doc to match local API behavior
    const result = await this._fetch(\`/api/\${args.collection}/\${args.id}\`, {
      method: 'PATCH',
      body: args.data,
    });
    return result.doc;
  }

  async delete(args) {
    // Payload API returns {doc, message} - extract doc to match local API behavior
    const result = await this._fetch(\`/api/\${args.collection}/\${args.id}\`, {
      method: 'DELETE',
    });
    return result.doc;
  }
}
`

// Append PayloadRPC code
workerCode += payloadRpcCode

writeFileSync(workerPath, workerCode)
console.log('Added PayloadRPC entrypoint to .open-next/worker.js')
