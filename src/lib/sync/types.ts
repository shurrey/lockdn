/**
 * P2P Sync Types
 *
 * Defines types for device pairing, sync state, and data synchronization.
 */

// Sync connection states
export type SyncStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'syncing'
  | 'error'

// Device information
export interface DeviceInfo {
  id: string
  name: string
  lastSeen: Date
  isOnline: boolean
}

// Paired device stored in database
export interface AuthorizedDevice {
  id: string
  name: string
  publicKey: string
  authorizedAt: Date
  lastSyncedAt?: Date
}

// Pairing data encoded in QR code
export interface PairingData {
  roomId: string
  secret: string
  deviceName: string
  expires: number
}

// Readable pairing code (for manual entry)
export interface PairingCode {
  code: string // 6-character alphanumeric
  roomId: string
  secret: string
  expires: number
}

// Sync message types
export type SyncMessageType =
  | 'sync_request' // Request full sync from peer
  | 'sync_response' // Response with full data
  | 'change' // Single record change
  | 'delete' // Record deletion (archive)
  | 'ack' // Acknowledgment
  | 'device_info' // Device identification handshake

// Table names that can be synced
export type SyncableTable =
  | 'courses'
  | 'assignments'
  | 'notes'
  | 'studyMaterials'
  | 'studySessions'
  | 'tutoringConversations'
  | 'dailySummaries'
  | 'analytics'
  | 'examAttempts'
  | 'semesterArchives'
  | 'tutorBehavioralProfile'
  | 'studyPlan'
  | 'preferences'

// Tables that should NOT sync (device-specific)
export const LOCAL_ONLY_TABLES = ['encryptedApiKeys'] as const

// Sync message payload
export interface SyncMessage {
  type: SyncMessageType
  id: string // Message ID for deduplication
  timestamp: number
  table?: SyncableTable
  recordId?: string
  data?: unknown
  version?: number // For conflict resolution
}

// Change record for tracking what needs to sync
export interface ChangeRecord {
  id: string
  table: SyncableTable
  recordId: string
  operation: 'create' | 'update' | 'delete'
  timestamp: number
  data?: unknown
  synced: boolean
}

// Sync state stored in Zustand
export interface SyncState {
  status: SyncStatus
  deviceId: string | null
  deviceName: string
  roomId: string | null
  connectedPeers: DeviceInfo[]
  lastSyncedAt: Date | null
  pendingChanges: number
  error: string | null
  syncVersion: number // Incremented after each sync to trigger UI refresh

  // Actions
  setStatus: (status: SyncStatus) => void
  setDeviceId: (id: string) => void
  setDeviceName: (name: string) => void
  setRoomId: (id: string | null) => void
  addPeer: (peer: DeviceInfo) => void
  removePeer: (peerId: string) => void
  updatePeer: (peerId: string, updates: Partial<DeviceInfo>) => void
  setLastSyncedAt: (date: Date) => void
  incrementSyncVersion: () => void
  setPendingChanges: (count: number) => void
  setError: (error: string | null) => void
  reset: () => void
}

// Signaling server message types
export interface SignalMessage {
  type: 'signal' | 'join' | 'leave' | 'ping' | 'peers' | 'pong' | 'hello' | 'welcome'
  from?: string
  to?: string
  peers?: Array<{ id: string; joinedAt: number }>
  payload?: unknown
  deviceId?: string  // For hello message
  yourId?: string    // For welcome message
}

// WebRTC configuration
export interface RTCConfig {
  iceServers: RTCIceServer[]
}

// Default STUN/TURN servers (free public ones)
export const DEFAULT_RTC_CONFIG: RTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
}

// Signaling server URL
// PartyKit URLs are: wss://{project}.{username}.partykit.dev
// Set VITE_SIGNALING_URL env var in Cloudflare Pages settings
export const SIGNALING_SERVER_URL =
  import.meta.env.VITE_SIGNALING_URL || 'wss://lockdn-sync.shurrey.partykit.dev'
