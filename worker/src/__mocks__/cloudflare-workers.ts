// Mock for cloudflare:workers module in tests

export class RpcTarget {
  // Base class for RPC targets in Cloudflare Workers
  // This is a mock implementation for testing
}

export class DurableObject {
  // Base class for Durable Objects
  // This is a mock implementation for testing
  constructor(public state: unknown, public env: unknown) {}
}
