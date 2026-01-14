/**
 * Web Crypto API utilities for encrypting/decrypting API keys
 *
 * Uses AES-GCM for encryption with PBKDF2 key derivation.
 * The encryption key is derived from a device-specific secret stored in localStorage.
 */

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const ITERATIONS = 100000
const SALT_LENGTH = 16
const IV_LENGTH = 12

// Get or create a device-specific secret for key derivation
async function getDeviceSecret(): Promise<string> {
  const storageKey = 'device_secret'
  let secret = localStorage.getItem(storageKey)

  if (!secret) {
    // Generate a random secret for this device
    const randomBytes = new Uint8Array(32)
    crypto.getRandomValues(randomBytes)
    secret = arrayBufferToBase64(randomBytes)
    localStorage.setItem(storageKey, secret)
  }

  return secret
}

// Derive an encryption key from the device secret and salt
async function deriveKey(salt: Uint8Array): Promise<CryptoKey> {
  const secret = await getDeviceSecret()
  const encoder = new TextEncoder()
  const secretData = encoder.encode(secret)

  // Import the secret as a key
  const baseKey = await crypto.subtle.importKey(
    'raw',
    secretData,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )

  // Derive the actual encryption key
  // Cast to BufferSource to satisfy TypeScript's strict type checking
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

// Convert Uint8Array to base64 string
function arrayBufferToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// Convert base64 string to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export interface EncryptedData {
  ciphertext: string // base64 encoded
  iv: string // base64 encoded
  salt: string // base64 encoded
}

/**
 * Encrypt a plaintext string using AES-GCM
 */
export async function encrypt(plaintext: string): Promise<EncryptedData> {
  const encoder = new TextEncoder()
  const data = encoder.encode(plaintext)

  // Generate random salt and IV
  const salt = new Uint8Array(SALT_LENGTH)
  crypto.getRandomValues(salt)

  const iv = new Uint8Array(IV_LENGTH)
  crypto.getRandomValues(iv)

  // Derive encryption key
  const key = await deriveKey(salt)

  // Encrypt the data
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data
  )

  return {
    ciphertext: arrayBufferToBase64(new Uint8Array(ciphertext)),
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt),
  }
}

/**
 * Decrypt an encrypted string using AES-GCM
 */
export async function decrypt(encrypted: EncryptedData): Promise<string> {
  const ciphertext = base64ToUint8Array(encrypted.ciphertext)
  const iv = base64ToUint8Array(encrypted.iv)
  const salt = base64ToUint8Array(encrypted.salt)

  // Derive the same key
  const key = await deriveKey(salt)

  // Decrypt the data
  // Cast to BufferSource to satisfy TypeScript's strict type checking
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: iv as unknown as BufferSource },
    key,
    ciphertext as unknown as BufferSource
  )

  const decoder = new TextDecoder()
  return decoder.decode(decrypted)
}

/**
 * Verify that an API key can be successfully encrypted and decrypted
 * Returns true if the round-trip is successful
 */
export async function verifyEncryption(apiKey: string): Promise<boolean> {
  try {
    const encrypted = await encrypt(apiKey)
    const decrypted = await decrypt(encrypted)
    return decrypted === apiKey
  } catch {
    return false
  }
}

/**
 * Clear the device secret (useful for data reset)
 */
export function clearDeviceSecret(): void {
  localStorage.removeItem('device_secret')
}
