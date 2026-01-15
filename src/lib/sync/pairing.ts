/**
 * Device Pairing
 *
 * Handles generation and validation of pairing codes for device sync.
 */

import type { PairingData, PairingCode } from './types'
import { useSyncStore } from './store'

// Pairing code expires after 5 minutes
const PAIRING_EXPIRY_MS = 5 * 60 * 1000

// Characters for readable codes (no ambiguous chars like 0/O, 1/I/l)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * Generate a random alphanumeric code
 */
function generateCode(length: number): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array)
    .map((b) => CODE_CHARS[b % CODE_CHARS.length])
    .join('')
}

/**
 * Generate a pairing code for display (manual entry)
 */
export function generatePairingCode(): PairingCode {
  const code = generateCode(6) // 6-character code
  const roomId = `lockdn-${code.toLowerCase()}`
  const secret = crypto.randomUUID()

  return {
    code,
    roomId,
    secret,
    expires: Date.now() + PAIRING_EXPIRY_MS,
  }
}

/**
 * Generate full pairing data for QR code
 */
export function generatePairingData(): PairingData {
  const { roomId, secret, expires } = generatePairingCode()
  const deviceName = useSyncStore.getState().deviceName

  return {
    roomId,
    secret,
    deviceName,
    expires,
  }
}

/**
 * Encode pairing data for QR code
 */
export function encodePairingData(data: PairingData): string {
  // Use base64url encoding for QR-friendly format
  const json = JSON.stringify(data)
  return btoa(json)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Decode pairing data from QR code
 */
export function decodePairingData(encoded: string): PairingData | null {
  try {
    // Restore base64 padding and characters
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    while (base64.length % 4) {
      base64 += '='
    }

    const json = atob(base64)
    const data = JSON.parse(json) as PairingData

    // Validate structure
    if (!data.roomId || !data.secret || !data.expires) {
      return null
    }

    return data
  } catch {
    return null
  }
}

/**
 * Parse a manual pairing code into room info
 */
export function parsePairingCode(code: string): {
  roomId: string
  isValid: boolean
} {
  // Clean up the code
  const cleaned = code.toUpperCase().replace(/[^A-Z0-9]/g, '')

  if (cleaned.length !== 6) {
    return { roomId: '', isValid: false }
  }

  return {
    roomId: `lockdn-${cleaned.toLowerCase()}`,
    isValid: true,
  }
}

/**
 * Check if pairing data is still valid (not expired)
 */
export function isPairingValid(data: PairingData): boolean {
  return data.expires > Date.now()
}

/**
 * Format a pairing code for display (with dash in middle)
 */
export function formatPairingCode(code: string): string {
  if (code.length !== 6) return code
  return `${code.slice(0, 3)}-${code.slice(3)}`
}

/**
 * Generate a verification checksum for confirming pairing
 * Both devices should show the same checksum
 */
export function generateVerificationCode(
  secret: string,
  peerId1: string,
  peerId2: string
): string {
  // Sort peer IDs for consistent ordering
  const sorted = [peerId1, peerId2].sort()
  const input = `${secret}:${sorted[0]}:${sorted[1]}`

  // Simple hash for display (not cryptographic)
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }

  // Convert to 4-digit code
  const code = Math.abs(hash % 10000)
    .toString()
    .padStart(4, '0')
  return code
}
