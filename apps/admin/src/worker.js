/**
 * Custom worker entrypoint for Payload CMS admin
 *
 * Wraps the OpenNext-generated worker and adds PayloadRPC entrypoint
 * for Workers RPC access from other services.
 */

import { WorkerEntrypoint } from 'cloudflare:workers';
import { getPayload } from 'payload';

// Re-export OpenNext's Durable Objects
export { DOQueueHandler } from '../.open-next/.build/durable-objects/queue.js';
export { DOShardedTagCache } from '../.open-next/.build/durable-objects/sharded-tag-cache.js';
export { BucketCachePurge } from '../.open-next/.build/durable-objects/bucket-cache-purge.js';

// Import the default handler from OpenNext
import openNextWorker from '../.open-next/worker.js';

// Re-export the default fetch handler
export default openNextWorker;

// Cache payload instance per isolate
let _payload = null;
let _payloadPromise = null;

async function getPayloadInstance(env) {
  if (_payload) return _payload;
  if (_payloadPromise) return _payloadPromise;

  _payloadPromise = (async () => {
    // Import config dynamically
    const { default: config } = await import('./payload.config');
    _payload = await getPayload({ config });
    return _payload;
  })();

  return _payloadPromise;
}

/**
 * PayloadRPC - Workers RPC entrypoint for Payload CMS
 *
 * Exposes Payload's local API via Cloudflare Workers RPC.
 * All methods default to overrideAccess=true for internal service calls.
 */
export class PayloadRPC extends WorkerEntrypoint {
  async find(args) {
    const payload = await getPayloadInstance(this.env);
    const result = await payload.find({
      collection: args.collection,
      where: args.where,
      limit: args.limit,
      depth: args.depth,
      sort: args.sort,
      overrideAccess: args.overrideAccess ?? true,
    });
    return {
      docs: result.docs,
      totalDocs: result.totalDocs,
    };
  }

  async findByID(args) {
    const payload = await getPayloadInstance(this.env);
    return payload.findByID({
      collection: args.collection,
      id: args.id,
      depth: args.depth,
      overrideAccess: args.overrideAccess ?? true,
    });
  }

  async create(args) {
    const payload = await getPayloadInstance(this.env);
    return payload.create({
      collection: args.collection,
      data: args.data,
      overrideAccess: args.overrideAccess ?? true,
    });
  }

  async update(args) {
    const payload = await getPayloadInstance(this.env);
    return payload.update({
      collection: args.collection,
      id: args.id,
      data: args.data,
      overrideAccess: args.overrideAccess ?? true,
    });
  }

  async delete(args) {
    const payload = await getPayloadInstance(this.env);
    return payload.delete({
      collection: args.collection,
      id: args.id,
      overrideAccess: args.overrideAccess ?? true,
    });
  }
}
