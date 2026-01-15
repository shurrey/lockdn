/**
 * Sync State Store
 *
 * Zustand store for managing P2P sync state.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SyncState, DeviceInfo, SyncStatus } from './types'

// Generate a unique device ID
function generateDeviceId(): string {
  return crypto.randomUUID()
}

// Get a default device name based on platform
function getDefaultDeviceName(): string {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return 'iPhone'
  if (/Android/.test(ua)) return 'Android'
  if (/Mac/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows PC'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Device'
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      status: 'disconnected',
      deviceId: null,
      deviceName: getDefaultDeviceName(),
      connectedPeers: [],
      lastSyncedAt: null,
      pendingChanges: 0,
      error: null,

      setStatus: (status: SyncStatus) => set({ status, error: null }),

      setDeviceId: (id: string) => set({ deviceId: id }),

      setDeviceName: (name: string) => set({ deviceName: name }),

      addPeer: (peer: DeviceInfo) =>
        set((state) => {
          // Don't add if already exists
          if (state.connectedPeers.some((p) => p.id === peer.id)) {
            return state
          }
          return { connectedPeers: [...state.connectedPeers, peer] }
        }),

      removePeer: (peerId: string) =>
        set((state) => ({
          connectedPeers: state.connectedPeers.filter((p) => p.id !== peerId),
        })),

      updatePeer: (peerId: string, updates: Partial<DeviceInfo>) =>
        set((state) => ({
          connectedPeers: state.connectedPeers.map((p) =>
            p.id === peerId ? { ...p, ...updates } : p
          ),
        })),

      setLastSyncedAt: (date: Date) => set({ lastSyncedAt: date }),

      setPendingChanges: (count: number) => set({ pendingChanges: count }),

      setError: (error: string | null) =>
        set({ error, status: error ? 'error' : 'disconnected' }),

      reset: () =>
        set({
          status: 'disconnected',
          connectedPeers: [],
          lastSyncedAt: null,
          pendingChanges: 0,
          error: null,
        }),
    }),
    {
      name: 'lockdn-sync-state',
      partialize: (state) => ({
        deviceId: state.deviceId,
        deviceName: state.deviceName,
        lastSyncedAt: state.lastSyncedAt,
      }),
      onRehydrateStorage: () => (state) => {
        // Initialize device ID if not set
        if (state && !state.deviceId) {
          state.setDeviceId(generateDeviceId())
        }
      },
    }
  )
)

// Initialize device ID on first load
const state = useSyncStore.getState()
if (!state.deviceId) {
  state.setDeviceId(generateDeviceId())
}
