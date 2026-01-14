import { describe, it, expect, beforeEach } from 'vitest'
import { encrypt, decrypt, verifyEncryption, clearDeviceSecret } from './crypto'

describe('crypto utilities', () => {
  beforeEach(() => {
    // Clear device secret before each test for isolation
    clearDeviceSecret()
    localStorage.clear()
  })

  describe('encrypt and decrypt', () => {
    it('should successfully encrypt and decrypt a simple string', async () => {
      const plaintext = 'sk-test-api-key-12345'
      const encrypted = await encrypt(plaintext)
      const decrypted = await decrypt(encrypted)

      expect(decrypted).toBe(plaintext)
    })

    it('should successfully encrypt and decrypt an empty string', async () => {
      const plaintext = ''
      const encrypted = await encrypt(plaintext)
      const decrypted = await decrypt(encrypted)

      expect(decrypted).toBe(plaintext)
    })

    it('should successfully encrypt and decrypt a long API key', async () => {
      const plaintext = 'sk-ant-api03-' + 'x'.repeat(100)
      const encrypted = await encrypt(plaintext)
      const decrypted = await decrypt(encrypted)

      expect(decrypted).toBe(plaintext)
    })

    it('should successfully encrypt and decrypt unicode characters', async () => {
      const plaintext = 'test-key-with-émojis-🔑-and-日本語'
      const encrypted = await encrypt(plaintext)
      const decrypted = await decrypt(encrypted)

      expect(decrypted).toBe(plaintext)
    })

    it('should produce different ciphertext for the same plaintext', async () => {
      const plaintext = 'sk-test-api-key'
      const encrypted1 = await encrypt(plaintext)
      const encrypted2 = await encrypt(plaintext)

      // Due to random IV and salt, ciphertexts should be different
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext)

      // But both should decrypt to the same value
      expect(await decrypt(encrypted1)).toBe(plaintext)
      expect(await decrypt(encrypted2)).toBe(plaintext)
    })

    it('should return encrypted data with required fields', async () => {
      const plaintext = 'test-api-key'
      const encrypted = await encrypt(plaintext)

      expect(encrypted).toHaveProperty('ciphertext')
      expect(encrypted).toHaveProperty('iv')
      expect(encrypted).toHaveProperty('salt')
      expect(typeof encrypted.ciphertext).toBe('string')
      expect(typeof encrypted.iv).toBe('string')
      expect(typeof encrypted.salt).toBe('string')
    })
  })

  describe('verifyEncryption', () => {
    it('should return true for valid encryption/decryption', async () => {
      const result = await verifyEncryption('sk-test-api-key')
      expect(result).toBe(true)
    })

    it('should return true for empty string', async () => {
      const result = await verifyEncryption('')
      expect(result).toBe(true)
    })
  })

  describe('device secret', () => {
    it('should persist device secret across encryptions', async () => {
      const plaintext = 'test-key'

      // First encryption creates the device secret
      const encrypted = await encrypt(plaintext)

      // Get the device secret
      const secret1 = localStorage.getItem('device_secret')
      expect(secret1).toBeTruthy()

      // Second encryption should use the same device secret
      await encrypt(plaintext)
      const secret2 = localStorage.getItem('device_secret')

      expect(secret1).toBe(secret2)

      // Decryption should still work
      const decrypted = await decrypt(encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('should fail to decrypt after clearing device secret', async () => {
      const plaintext = 'test-key'
      const encrypted = await encrypt(plaintext)

      // Clear the device secret
      clearDeviceSecret()

      // Decryption should fail (different derived key)
      await expect(decrypt(encrypted)).rejects.toThrow()
    })
  })
})
