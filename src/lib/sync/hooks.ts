/**
 * Sync Hooks
 *
 * React hooks for P2P sync functionality.
 */

import { useCallback, useEffect, useState } from 'react'
import { useSyncStore } from './store'
import { syncProvider } from './provider'
import {
  generatePairingCode,
  generatePairingData,
  encodePairingData,
  decodePairingData,
  parsePairingCode,
  isPairingValid,
  formatPairingCode,
} from './pairing'
import type { PairingCode, PairingData } from './types'

/**
 * Hook for accessing sync state
 */
export function useSyncStatus() {
  const status = useSyncStore((s) => s.status)
  const connectedPeers = useSyncStore((s) => s.connectedPeers)
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt)
  const pendingChanges = useSyncStore((s) => s.pendingChanges)
  const error = useSyncStore((s) => s.error)

  return {
    status,
    connectedPeers,
    lastSyncedAt,
    pendingChanges,
    error,
    isConnected: status === 'connected' || status === 'syncing',
    isSyncing: status === 'syncing',
    hasError: status === 'error',
    peerCount: connectedPeers.length,
  }
}

/**
 * Hook for device info
 */
export function useDeviceInfo() {
  const deviceId = useSyncStore((s) => s.deviceId)
  const deviceName = useSyncStore((s) => s.deviceName)
  const setDeviceName = useSyncStore((s) => s.setDeviceName)

  return {
    deviceId,
    deviceName,
    setDeviceName,
  }
}

/**
 * Hook for generating pairing codes
 */
export function usePairingCode() {
  const [pairingCode, setPairingCode] = useState<PairingCode | null>(null)
  const [pairingData, setPairingData] = useState<PairingData | null>(null)
  const [qrData, setQrData] = useState<string | null>(null)
  const [isExpired, setIsExpired] = useState(false)

  const generate = useCallback(() => {
    const code = generatePairingCode()
    const data = generatePairingData()
    const encoded = encodePairingData(data)

    setPairingCode(code)
    setPairingData(data)
    setQrData(encoded)
    setIsExpired(false)

    return { code, data, qrData: encoded }
  }, [])

  // Check expiration
  useEffect(() => {
    if (!pairingData) return

    const checkExpiry = () => {
      if (!isPairingValid(pairingData)) {
        setIsExpired(true)
      }
    }

    const interval = setInterval(checkExpiry, 1000)
    return () => clearInterval(interval)
  }, [pairingData])

  const formattedCode = pairingCode ? formatPairingCode(pairingCode.code) : null

  return {
    pairingCode,
    pairingData,
    qrData,
    formattedCode,
    isExpired,
    generate,
    refresh: generate,
  }
}

/**
 * Hook for joining a sync room
 */
export function useJoinSync() {
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const joinWithCode = useCallback(async (code: string) => {
    setIsJoining(true)
    setError(null)

    try {
      const { roomId, isValid } = parsePairingCode(code)
      if (!isValid) {
        throw new Error('Invalid pairing code')
      }

      await syncProvider.connect(roomId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join')
    } finally {
      setIsJoining(false)
    }
  }, [])

  const joinWithQR = useCallback(async (qrData: string) => {
    setIsJoining(true)
    setError(null)

    try {
      const data = decodePairingData(qrData)
      if (!data) {
        throw new Error('Invalid QR code')
      }

      if (!isPairingValid(data)) {
        throw new Error('Pairing code has expired')
      }

      await syncProvider.connect(data.roomId, data.secret)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join')
    } finally {
      setIsJoining(false)
    }
  }, [])

  return {
    joinWithCode,
    joinWithQR,
    isJoining,
    error,
    clearError: () => setError(null),
  }
}

/**
 * Hook for managing sync connection
 */
export function useSyncConnection() {
  const { status, isConnected, peerCount } = useSyncStatus()

  const connect = useCallback(async (roomId: string, secret?: string) => {
    await syncProvider.connect(roomId, secret)
  }, [])

  const disconnect = useCallback(async () => {
    await syncProvider.disconnect()
  }, [])

  return {
    status,
    isConnected,
    peerCount,
    connect,
    disconnect,
  }
}

/**
 * Hook to automatically sync changes
 * Call this in a component that wraps the app to enable auto-sync
 */
export function useAutoSync() {
  const { isConnected } = useSyncStatus()

  // This hook could be extended to:
  // 1. Listen to Dexie changes via hooks
  // 2. Call syncProvider.notifyChange() when data changes
  // 3. Handle reconnection logic

  useEffect(() => {
    // For now, just log connection status
    if (isConnected) {
      console.log('[Sync] Connected to sync network')
    }
  }, [isConnected])

  return { isConnected }
}
