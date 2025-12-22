/**
 * Encryption utilities for sensitive data in Cloudflare Workers
 *
 * Uses AES-256-GCM for authenticated encryption, compatible with
 * the admin app's encryption format (apps/admin/src/lib/encryption.ts)
 *
 * Format: iv:authTag:encryptedData (all hex encoded)
 */

const ALGORITHM = 'AES-GCM'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 128 // bits for Web Crypto API

/**
 * Convert a hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}

/**
 * Convert a Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Derive a 256-bit key from a secret using SHA-256
 * (matching the admin app's key derivation)
 */
async function deriveKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)

  // Hash the secret to get 32 bytes
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData)

  // Import as AES-GCM key
  return crypto.subtle.importKey('raw', hashBuffer, { name: ALGORITHM }, false, [
    'encrypt',
    'decrypt',
  ])
}

/**
 * Encrypt a string value using AES-256-GCM
 * @param plainText - The plain text to encrypt
 * @param secret - The secret key (will be hashed to 32 bytes)
 * @returns Encrypted string in format: iv:authTag:encryptedData (all hex encoded)
 */
export async function encrypt(plainText: string, secret: string): Promise<string> {
  const key = await deriveKey(secret)

  // Generate a random IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  // Encrypt the data
  const encoder = new TextEncoder()
  const data = encoder.encode(plainText)

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv,
      tagLength: AUTH_TAG_LENGTH,
    },
    key,
    data
  )

  // The encrypted buffer includes the auth tag at the end
  // AES-GCM in Web Crypto API appends the tag (16 bytes) to the ciphertext
  const encryptedBytes = new Uint8Array(encryptedBuffer)
  const tagLength = AUTH_TAG_LENGTH / 8 // 16 bytes

  // Extract ciphertext and auth tag
  const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - tagLength)
  const authTag = encryptedBytes.slice(encryptedBytes.length - tagLength)

  // Return in format: iv:authTag:encryptedData
  return `${bytesToHex(iv)}:${bytesToHex(authTag)}:${bytesToHex(ciphertext)}`
}

/**
 * Decrypt a string value encrypted with AES-256-GCM
 * @param encryptedText - The encrypted text in format: iv:authTag:encryptedData
 * @param secret - The secret key (will be hashed to 32 bytes)
 * @returns Decrypted plain text
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 */
export async function decrypt(encryptedText: string, secret: string): Promise<string> {
  const key = await deriveKey(secret)

  // Split the encrypted text
  const parts = encryptedText.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format')
  }

  const [ivHex, authTagHex, ciphertextHex] = parts

  // Convert from hex
  const iv = hexToBytes(ivHex)
  const authTag = hexToBytes(authTagHex)
  const ciphertext = hexToBytes(ciphertextHex)

  // Validate lengths
  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`)
  }
  if (authTag.length !== AUTH_TAG_LENGTH / 8) {
    throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH / 8}, got ${authTag.length}`)
  }

  // Web Crypto API expects the auth tag appended to the ciphertext
  const encryptedWithTag = new Uint8Array(ciphertext.length + authTag.length)
  encryptedWithTag.set(ciphertext, 0)
  encryptedWithTag.set(authTag, ciphertext.length)

  // Decrypt the data
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: iv.buffer as ArrayBuffer,
      tagLength: AUTH_TAG_LENGTH,
    },
    key,
    encryptedWithTag.buffer as ArrayBuffer
  )

  // Decode as UTF-8
  const decoder = new TextDecoder()
  return decoder.decode(decryptedBuffer)
}

/**
 * Check if a value is encrypted (has the expected format)
 */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false
  }

  const parts = value.split(':')
  if (parts.length !== 3) {
    return false
  }

  // Check if each part is valid hex
  const [iv, authTag, ciphertext] = parts
  const hexPattern = /^[0-9a-fA-F]+$/

  // IV should be 16 bytes = 32 hex chars
  // Auth tag should be 16 bytes = 32 hex chars
  // Ciphertext can be any length
  return (
    iv.length === 32 &&
    hexPattern.test(iv) &&
    authTag.length === 32 &&
    hexPattern.test(authTag) &&
    ciphertext.length > 0 &&
    hexPattern.test(ciphertext)
  )
}

/**
 * Decrypt a PAT, returning empty string if decryption fails or value is empty
 * This is a safe wrapper for use in PRDO actions
 */
export async function decryptPAT(
  encryptedPAT: string | undefined,
  encryptionKey: string
): Promise<string> {
  if (!encryptedPAT) {
    return ''
  }

  // If it's not in encrypted format, return as-is (for backwards compatibility)
  if (!isEncrypted(encryptedPAT)) {
    console.warn('[encryption] PAT is not in encrypted format, returning as-is')
    return encryptedPAT
  }

  try {
    return await decrypt(encryptedPAT, encryptionKey)
  } catch (error) {
    console.error('[encryption] Failed to decrypt PAT:', error)
    return ''
  }
}
