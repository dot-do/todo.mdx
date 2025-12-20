// Type definitions for Cloudflare Worker bindings

declare global {
  interface CloudflareEnv {
    D1: D1Database
    R2: R2Bucket
  }
}

export {}
