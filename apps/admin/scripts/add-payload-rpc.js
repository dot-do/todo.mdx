#!/usr/bin/env node
/**
 * Post-build script to add PayloadRPC export to the OpenNext worker
 *
 * This appends our PayloadRPC WorkerEntrypoint to the generated worker.js
 * so other workers can call Payload via typed RPC.
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

const payloadRpcCode = `
// ============================================
// PayloadRPC - Workers RPC entrypoint for Payload CMS
// Added by scripts/add-payload-rpc.js
// ============================================

import { WorkerEntrypoint } from 'cloudflare:workers';

export class PayloadRPC extends WorkerEntrypoint {
  async find(args) {
    const params = new URLSearchParams();
    if (args.where) params.set('where', JSON.stringify(args.where));
    if (args.limit) params.set('limit', String(args.limit));
    if (args.depth) params.set('depth', String(args.depth));
    if (args.sort) params.set('sort', args.sort);

    const url = new URL(\`/api/\${args.collection}?\${params}\`, 'http://localhost');
    const request = new Request(url, {
      headers: { 'Content-Type': 'application/json' }
    });

    const response = await this.env.ASSETS?.fetch(request) ||
      await runWithCloudflareRequestContext(request, this.env, this.ctx, async () => {
        const { handler } = await import("./server-functions/default/handler.mjs");
        return handler(request, this.env, this.ctx);
      });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(\`Payload find failed: \${response.status} \${text}\`);
    }
    return response.json();
  }

  async findByID(args) {
    const params = new URLSearchParams();
    if (args.depth) params.set('depth', String(args.depth));

    const url = new URL(\`/api/\${args.collection}/\${args.id}?\${params}\`, 'http://localhost');
    const request = new Request(url, {
      headers: { 'Content-Type': 'application/json' }
    });

    const response = await runWithCloudflareRequestContext(request, this.env, this.ctx, async () => {
      const { handler } = await import("./server-functions/default/handler.mjs");
      return handler(request, this.env, this.ctx);
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(\`Payload findByID failed: \${response.status} \${text}\`);
    }
    return response.json();
  }

  async create(args) {
    const url = new URL(\`/api/\${args.collection}\`, 'http://localhost');
    const request = new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args.data)
    });

    const response = await runWithCloudflareRequestContext(request, this.env, this.ctx, async () => {
      const { handler } = await import("./server-functions/default/handler.mjs");
      return handler(request, this.env, this.ctx);
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(\`Payload create failed: \${response.status} \${text}\`);
    }
    return response.json();
  }

  async update(args) {
    const url = new URL(\`/api/\${args.collection}/\${args.id}\`, 'http://localhost');
    const request = new Request(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args.data)
    });

    const response = await runWithCloudflareRequestContext(request, this.env, this.ctx, async () => {
      const { handler } = await import("./server-functions/default/handler.mjs");
      return handler(request, this.env, this.ctx);
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(\`Payload update failed: \${response.status} \${text}\`);
    }
    return response.json();
  }

  async delete(args) {
    const url = new URL(\`/api/\${args.collection}/\${args.id}\`, 'http://localhost');
    const request = new Request(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    const response = await runWithCloudflareRequestContext(request, this.env, this.ctx, async () => {
      const { handler } = await import("./server-functions/default/handler.mjs");
      return handler(request, this.env, this.ctx);
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(\`Payload delete failed: \${response.status} \${text}\`);
    }
    return response.json();
  }
}
`

// Read existing worker.js
let workerCode = readFileSync(workerPath, 'utf-8')

// Check if PayloadRPC is already added
if (workerCode.includes('export class PayloadRPC')) {
  console.log('PayloadRPC already exists in worker.js, skipping.')
  process.exit(0)
}

// Append PayloadRPC code
workerCode += payloadRpcCode

writeFileSync(workerPath, workerCode)
console.log('Added PayloadRPC export to .open-next/worker.js')
