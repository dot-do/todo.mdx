/**
 * Encryption utilities for sensitive data
 * Uses AES-256-GCM for authenticated encryption
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

/**
 * Encrypt a string value using AES-256-GCM
 * @param plainText - The plain text to encrypt
 * @param secret - The secret key (will be hashed to 32 bytes)
 * @returns Encrypted string in format: iv:authTag:encryptedData (all hex encoded)
 */
export async function encrypt(plainText: string, secret: string): Promise<string> {
  // Derive a 32-byte key from the secret
  const key = crypto.createHash('sha256').update(secret).digest()

  // Generate a random IV
  const iv = crypto.randomBytes(IV_LENGTH)

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  // Encrypt the data
  let encrypted = cipher.update(plainText, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  // Get the authentication tag
  const authTag = cipher.getAuthTag()

  // Return in format: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypt a string value encrypted with AES-256-GCM
 * @param encryptedText - The encrypted text in format: iv:authTag:encryptedData
 * @param secret - The secret key (will be hashed to 32 bytes)
 * @returns Decrypted plain text
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 */
export async function decrypt(encryptedText: string, secret: string): Promise<string> {
  // Derive a 32-byte key from the secret
  const key = crypto.createHash('sha256').update(secret).digest()

  // Split the encrypted text
  const parts = encryptedText.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format')
  }

  const [ivHex, authTagHex, encrypted] = parts

  // Convert from hex
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  // Validate lengths
  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid IV or auth tag length')
  }

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  // Decrypt the data
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Check if a value is encrypted (has the expected format)
 */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false
  }

  const parts = value.split(':')
  return parts.length === 3
}
