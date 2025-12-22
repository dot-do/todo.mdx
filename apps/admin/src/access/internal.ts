import type { AccessArgs, PayloadRequest } from 'payload'

/**
 * Check if the request is an internal RPC call.
 * Internal calls have the X-Payload-Internal header set.
 */
export function isInternalRequest(req: PayloadRequest): boolean {
  try {
    // Check for internal header from PayloadRPC
    // Handle both Headers object (.get) and plain object access
    const headers = req.headers
    if (!headers) return false

    if (typeof headers.get === 'function') {
      const value = headers.get('x-payload-internal')
      return value === 'true'
    }

    // Fallback for plain object headers
    const headerObj = headers as unknown as Record<string, string>
    return headerObj['x-payload-internal'] === 'true' ||
           headerObj['X-Payload-Internal'] === 'true'
  } catch {
    return false
  }
}

/**
 * Create an access function that allows internal requests.
 * Falls back to the provided access function for normal requests.
 */
export function withInternalAccess(
  accessFn: (args: AccessArgs) => boolean | Record<string, any> | Promise<boolean | Record<string, any>>
) {
  return async (args: AccessArgs): Promise<boolean | Record<string, any>> => {
    // Allow all internal requests
    if (isInternalRequest(args.req)) {
      return true
    }
    // Otherwise use the original access function
    return accessFn(args)
  }
}

/**
 * Shorthand access function that only allows internal requests or admins.
 */
export function internalOrAdmin({ req }: AccessArgs): boolean {
  if (isInternalRequest(req)) return true
  return req.user?.roles?.includes('admin') ?? false
}
