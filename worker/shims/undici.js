// Shim for undici in Workers environment
// Workers has native fetch, so we export the native implementations

// Native Web API exports
export const Headers = globalThis.Headers
export const Request = globalThis.Request
export const Response = globalThis.Response
export const fetch = globalThis.fetch
export const FormData = globalThis.FormData

// Agent class stub - used by Payload's safeFetch
// Must be a class with proper constructor
export class Agent {
  constructor(options) {
    this.options = options
  }
  dispatch(opts, handler) {
    return false
  }
  close() {
    return Promise.resolve()
  }
  destroy() {
    return Promise.resolve()
  }
}

// Default export with all named exports
export default {
  Headers,
  Request,
  Response,
  fetch,
  FormData,
  Agent,
}
