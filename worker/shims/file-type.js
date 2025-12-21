// Shim for file-type functions that aren't available in Workers environment
// These are imported by Payload but not used in our Workers code

// Named exports that Payload's upload modules try to use
export async function fileTypeFromFile() {
  return undefined
}

export async function fileTypeFromBuffer() {
  return undefined
}

export async function fileTypeFromStream() {
  return undefined
}

// Default export
export default {
  fileTypeFromFile,
  fileTypeFromBuffer,
  fileTypeFromStream,
}
