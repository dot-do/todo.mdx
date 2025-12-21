// Shim for Node.js url module in Workers environment

export function fileURLToPath(url) {
  if (typeof url === 'string') {
    // Handle file:// URLs
    if (url.startsWith('file://')) {
      return url.slice(7)
    }
    return url
  }
  if (url instanceof URL) {
    return url.pathname
  }
  // Return a placeholder path for undefined
  return '/worker'
}

export function pathToFileURL(path) {
  return new URL(`file://${path}`)
}

export const URL = globalThis.URL
export const URLSearchParams = globalThis.URLSearchParams

export default {
  fileURLToPath,
  pathToFileURL,
  URL,
  URLSearchParams
}
