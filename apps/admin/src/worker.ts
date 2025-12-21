/**
 * Custom worker entrypoint for Payload CMS admin
 *
 * This wraps the OpenNext-generated worker and adds our PayloadRPC entrypoint
 * for Workers RPC access from other services.
 */

// Re-export OpenNext's Durable Objects
export { DOQueueHandler } from '../.open-next/.build/durable-objects/queue.js'
export { DOShardedTagCache } from '../.open-next/.build/durable-objects/sharded-tag-cache.js'
export { BucketCachePurge } from '../.open-next/.build/durable-objects/bucket-cache-purge.js'

// Export PayloadRPC for Workers RPC
export { PayloadRPC } from './payload-rpc'

// Re-export the default fetch handler from OpenNext
// @ts-expect-error - OpenNext generated file
import openNextWorker from '../.open-next/worker.js'
export default openNextWorker
