/**
 * TDD Tests for Encryption Utilities
 *
 * These tests define the DESIRED behavior first (RED),
 * then we fix code to pass (GREEN).
 */

import { describe, it, expect } from 'vitest'
import { encrypt, decrypt, isEncrypted } from './encryption'

describe('encryption utilities', () => {
  const TEST_KEY = 'a'.repeat(64) // 32 bytes in hex (256 bits)
  const TEST_VALUE = 'my-secret-token'

  describe('encrypt', () => {
    it('returns a string in format iv:authTag:encryptedData', async () => {
      const result = await encrypt(TEST_VALUE, TEST_KEY)
      const parts = result.split(':')

      expect(parts).toHaveLength(3)
      expect(parts[0]).toHaveLength(32) // IV is 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32) // authTag is 16 bytes = 32 hex chars
      expect(parts[2].length).toBeGreaterThan(0) // encrypted data
    })

    it('produces different output each time (random IV)', async () => {
      const result1 = await encrypt(TEST_VALUE, TEST_KEY)
      const result2 = await encrypt(TEST_VALUE, TEST_KEY)

      expect(result1).not.toBe(result2)
    })

    it('throws on empty value', async () => {
      await expect(encrypt('', TEST_KEY)).rejects.toThrow()
    })

    it('throws on invalid key length', async () => {
      await expect(encrypt(TEST_VALUE, 'short-key')).rejects.toThrow()
    })
  })

  describe('decrypt', () => {
    it('decrypts encrypted value back to original', async () => {
      const encrypted = await encrypt(TEST_VALUE, TEST_KEY)
      const decrypted = await decrypt(encrypted, TEST_KEY)

      expect(decrypted).toBe(TEST_VALUE)
    })

    it('throws on invalid encrypted format', async () => {
      await expect(decrypt('not:valid', TEST_KEY)).rejects.toThrow()
    })

    it('throws on tampered ciphertext', async () => {
      const encrypted = await encrypt(TEST_VALUE, TEST_KEY)
      const parts = encrypted.split(':')
      // Tamper with the encrypted data
      parts[2] = 'ff' + parts[2].slice(2)
      const tampered = parts.join(':')

      await expect(decrypt(tampered, TEST_KEY)).rejects.toThrow()
    })

    it('throws on wrong key', async () => {
      const encrypted = await encrypt(TEST_VALUE, TEST_KEY)
      const wrongKey = 'b'.repeat(64)

      await expect(decrypt(encrypted, wrongKey)).rejects.toThrow()
    })
  })

  describe('isEncrypted', () => {
    it('returns true for properly encrypted values', async () => {
      const encrypted = await encrypt(TEST_VALUE, TEST_KEY)
      expect(isEncrypted(encrypted)).toBe(true)
    })

    it('returns false for plain text', () => {
      expect(isEncrypted('plain-text-value')).toBe(false)
    })

    it('returns false for empty string', () => {
      expect(isEncrypted('')).toBe(false)
    })

    it('returns false for null/undefined', () => {
      expect(isEncrypted(null as any)).toBe(false)
      expect(isEncrypted(undefined as any)).toBe(false)
    })

    it('returns false for URLs with ports (false positive prevention)', () => {
      // This was a bug - URLs with 2 colons looked like encrypted values
      expect(isEncrypted('http://host:port:path')).toBe(false)
      expect(isEncrypted('redis://localhost:6379:0')).toBe(false)
    })

    it('returns false for timestamps with colons', () => {
      expect(isEncrypted('2024:01:01')).toBe(false)
      expect(isEncrypted('12:30:45')).toBe(false)
    })

    it('returns false for values with wrong IV length', () => {
      // IV should be 32 hex chars (16 bytes)
      const shortIv = 'aa'.repeat(10) + ':' + 'bb'.repeat(16) + ':' + 'cc'.repeat(20)
      expect(isEncrypted(shortIv)).toBe(false)
    })

    it('returns false for values with non-hex characters', () => {
      const invalidHex = 'zz'.repeat(16) + ':' + 'bb'.repeat(16) + ':' + 'cc'.repeat(20)
      expect(isEncrypted(invalidHex)).toBe(false)
    })
  })
})
