/**
 * P2P Sync Module
 *
 * Provides device-to-device synchronization for Lockdn.
 */

// Types
export type {
  SyncStatus,
  DeviceInfo,
  AuthorizedDevice,
  PairingData,
  PairingCode,
  SyncMessage,
  SyncableTable,
} from './types'

// Constants
export { DEFAULT_RTC_CONFIG, SIGNALING_SERVER_URL, LOCAL_ONLY_TABLES } from './types'

// Store
export { useSyncStore } from './store'

// Provider
export { syncProvider } from './provider'

// Pairing utilities
export {
  generatePairingCode,
  encodePairingData,
  decodePairingData,
  parsePairingCode,
  isPairingValid,
  formatPairingCode,
  generateVerificationCode,
} from './pairing'

// Hooks
export {
  useSyncStatus,
  useDeviceInfo,
  usePairingCode,
  useJoinSync,
  useSyncConnection,
  useAutoSync,
} from './hooks'

// Dexie hooks for real-time sync
export { setupSyncHooks } from './dexie-hooks'
