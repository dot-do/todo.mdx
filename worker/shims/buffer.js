// Buffer shim for Cloudflare Workers
// Workers has native Buffer support via nodejs_compat
export const Buffer = globalThis.Buffer
export default { Buffer }
