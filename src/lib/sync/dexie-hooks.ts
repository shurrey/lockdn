/**
 * Dexie Hooks for Real-Time Sync
 *
 * Sets up Dexie table hooks to automatically notify peers when data changes.
 */

import Dexie from 'dexie'
import { db } from '@/db'
import { syncProvider } from './provider'
import type { SyncableTable } from './types'

// Tables that should sync (excludes encryptedApiKeys for security)
const SYNCABLE_TABLES: SyncableTable[] = [
  'courses',
  'assignments',
  'notes',
  'studyMaterials',
  'studySessions',
  'tutoringConversations',
  'dailySummaries',
  'analytics',
  'examAttempts',
  'semesterArchives',
  'tutorBehavioralProfile',
  'studyPlan',
  'preferences',
]

// Flag to prevent infinite loops when applying remote changes
let isApplyingRemoteChange = false

/**
 * Set the remote change flag (called by provider when applying remote changes)
 */
export function setApplyingRemoteChange(value: boolean): void {
  isApplyingRemoteChange = value
}

/**
 * Check if we're currently applying a remote change
 */
export function isApplyingRemote(): boolean {
  return isApplyingRemoteChange
}

/**
 * Set up Dexie hooks for real-time sync
 * Call this once when the app initializes
 */
export function setupSyncHooks(): void {
  for (const tableName of SYNCABLE_TABLES) {
    // Use any to bypass strict typing - Dexie hooks have complex overloads
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = (db as any)[tableName] as Dexie.Table | undefined
    if (!table || typeof table.hook !== 'function') continue

    // Hook into creating (new records)
    table.hook('creating', function (
      this: unknown,
      primKey: string,
      obj: Record<string, unknown>
    ) {
      // Capture the flag NOW, not in the setTimeout callback
      const shouldSkip = isApplyingRemoteChange
      if (!shouldSkip && syncProvider.isConnected()) {
        // Clone the object to avoid issues with transaction timing
        const objCopy = JSON.parse(JSON.stringify(obj))
        // Use setTimeout to avoid blocking the transaction
        setTimeout(() => {
          // Double-check we're still connected
          if (syncProvider.isConnected()) {
            syncProvider.notifyChange(tableName, primKey, objCopy)
          }
        }, 0)
      }
    })

    // Hook into updating (modified records)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(table.hook as any)('updating', function (
      this: unknown,
      modifications: Record<string, unknown>,
      primKey: string,
      obj: Record<string, unknown>
    ) {
      // Capture the flag NOW, not in the setTimeout callback
      const shouldSkip = isApplyingRemoteChange
      if (!shouldSkip && syncProvider.isConnected()) {
        // Merge modifications with existing object and clone
        const updatedObj = JSON.parse(JSON.stringify({ ...obj, ...modifications }))
        setTimeout(() => {
          if (syncProvider.isConnected()) {
            syncProvider.notifyChange(tableName, primKey, updatedObj)
          }
        }, 0)
      }
    })

    // Hook into deleting
    table.hook('deleting', function (
      this: unknown,
      primKey: string
    ) {
      // Capture the flag NOW, not in the setTimeout callback
      const shouldSkip = isApplyingRemoteChange
      if (!shouldSkip && syncProvider.isConnected()) {
        setTimeout(() => {
          if (syncProvider.isConnected()) {
            syncProvider.notifyDelete(tableName, primKey)
          }
        }, 0)
      }
    })
  }
}
