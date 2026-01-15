/**
 * Sync Provider
 *
 * Manages WebRTC connections and data synchronization between devices.
 */

import Dexie from 'dexie'
import { db } from '@/db'
import type {
  SignalMessage,
  SyncMessage,
  SyncableTable,
} from './types'
import { DEFAULT_RTC_CONFIG, SIGNALING_SERVER_URL } from './types'
import { useSyncStore } from './store'

// WebRTC data channel label
const DATA_CHANNEL_LABEL = 'lockdn-sync'

// Tables to sync and their priority (lower = sync first)
const SYNC_TABLES: Record<SyncableTable, number> = {
  preferences: 1,
  courses: 2,
  assignments: 3,
  notes: 4,
  studyMaterials: 5,
  studySessions: 6,
  tutoringConversations: 7,
  dailySummaries: 8,
  analytics: 9,
  examAttempts: 10,
  semesterArchives: 11,
  tutorBehavioralProfile: 12,
  studyPlan: 13,
}

interface PeerConnection {
  pc: RTCPeerConnection
  dc: RTCDataChannel | null
  peerId: string
}

class SyncProvider {
  private ws: WebSocket | null = null
  private peers: Map<string, PeerConnection> = new Map()
  private roomId: string | null = null
  private pairingSecret: string | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null

  /**
   * Connect to a sync room
   */
  async connect(roomId: string, secret?: string): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      await this.disconnect()
    }

    this.roomId = roomId
    this.pairingSecret = secret || null

    const store = useSyncStore.getState()
    store.setStatus('connecting')

    return new Promise((resolve, reject) => {
      const url = `${SIGNALING_SERVER_URL}/party/${roomId}`
      console.log('[Sync] Connecting to:', url)

      try {
        this.ws = new WebSocket(url)

        this.ws.onopen = () => {
          console.log('[Sync] WebSocket connected')
          store.setStatus('connected')
          this.startPing()
          resolve()
        }

        this.ws.onclose = (event) => {
          console.log('[Sync] WebSocket closed:', event.code, event.reason)
          this.handleDisconnect()
        }

        this.ws.onerror = (error) => {
          console.error('[Sync] WebSocket error:', error)
          store.setError('Failed to connect to sync server')
          reject(error)
        }

        this.ws.onmessage = (event) => {
          console.log('[Sync] Message received:', event.data)
          this.handleSignalMessage(event.data)
        }
      } catch (error) {
        console.error('[Sync] Connection error:', error)
        store.setError('Failed to connect to sync server')
        reject(error)
      }
    })
  }

  /**
   * Disconnect from sync
   */
  async disconnect(): Promise<void> {
    // Stop timers
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    // Close peer connections
    for (const [, peer] of this.peers) {
      peer.dc?.close()
      peer.pc.close()
    }
    this.peers.clear()

    // Close WebSocket
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.roomId = null
    this.pairingSecret = null

    useSyncStore.getState().reset()
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnect(): void {
    const store = useSyncStore.getState()
    store.setStatus('disconnected')

    // Attempt reconnect after delay
    if (this.roomId) {
      this.reconnectTimer = setTimeout(() => {
        this.connect(this.roomId!, this.pairingSecret || undefined)
      }, 5000)
    }
  }

  /**
   * Start ping/pong for keepalive
   */
  private startPing(): void {
    this.pingTimer = setInterval(() => {
      this.sendSignal({ type: 'ping' })
    }, 30000)
  }

  /**
   * Send a message to the signaling server
   */
  private sendSignal(message: Partial<SignalMessage>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  /**
   * Handle incoming signaling messages
   */
  private async handleSignalMessage(data: string): Promise<void> {
    try {
      const message = JSON.parse(data) as SignalMessage

      switch (message.type) {
        case 'peers':
          // Received list of existing peers in room
          if (message.peers) {
            for (const peer of message.peers) {
              await this.initiatePeerConnection(peer.id)
            }
          }
          break

        case 'join':
          // New peer joined
          if (message.from) {
            await this.initiatePeerConnection(message.from)
          }
          break

        case 'leave':
          // Peer left
          if (message.from) {
            this.handlePeerLeave(message.from)
          }
          break

        case 'signal':
          // WebRTC signaling message
          if (message.from && message.payload) {
            await this.handleRTCSignal(
              message.from,
              message.payload as {
                type: string
                sdp?: RTCSessionDescriptionInit
                candidate?: RTCIceCandidate
              }
            )
          }
          break

        case 'pong':
          // Keepalive response, ignore
          break
      }
    } catch {
      // Invalid message, ignore
    }
  }

  /**
   * Initiate a peer connection
   */
  private async initiatePeerConnection(peerId: string): Promise<void> {
    if (this.peers.has(peerId)) return

    const pc = new RTCPeerConnection(DEFAULT_RTC_CONFIG)
    const peerConn: PeerConnection = { pc, dc: null, peerId }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          type: 'signal',
          to: peerId,
          payload: { type: 'ice', candidate: event.candidate },
        })
      }
    }

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        this.handlePeerConnected(peerId)
      } else if (
        pc.connectionState === 'disconnected' ||
        pc.connectionState === 'failed'
      ) {
        this.handlePeerLeave(peerId)
      }
    }

    // Handle incoming data channels
    pc.ondatachannel = (event) => {
      peerConn.dc = event.channel
      this.setupDataChannel(peerConn)
    }

    this.peers.set(peerId, peerConn)

    // Create data channel and offer (initiator)
    const deviceId = useSyncStore.getState().deviceId
    if (deviceId && deviceId < peerId) {
      // Lower ID initiates
      peerConn.dc = pc.createDataChannel(DATA_CHANNEL_LABEL)
      this.setupDataChannel(peerConn)

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      this.sendSignal({
        type: 'signal',
        to: peerId,
        payload: { type: 'offer', sdp: offer },
      })
    }
  }

  /**
   * Handle WebRTC signaling messages
   */
  private async handleRTCSignal(
    peerId: string,
    payload: {
      type: string
      sdp?: RTCSessionDescriptionInit
      candidate?: RTCIceCandidate
    }
  ): Promise<void> {
    let peerConn = this.peers.get(peerId)

    if (!peerConn && payload.type === 'offer') {
      // Create peer connection for incoming offer
      const pc = new RTCPeerConnection(DEFAULT_RTC_CONFIG)
      peerConn = { pc, dc: null, peerId }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignal({
            type: 'signal',
            to: peerId,
            payload: { type: 'ice', candidate: event.candidate },
          })
        }
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          this.handlePeerConnected(peerId)
        } else if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed'
        ) {
          this.handlePeerLeave(peerId)
        }
      }

      pc.ondatachannel = (event) => {
        peerConn!.dc = event.channel
        this.setupDataChannel(peerConn!)
      }

      this.peers.set(peerId, peerConn)
    }

    if (!peerConn) return

    const { pc } = peerConn

    switch (payload.type) {
      case 'offer':
        if (payload.sdp) {
          await pc.setRemoteDescription(payload.sdp)
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          this.sendSignal({
            type: 'signal',
            to: peerId,
            payload: { type: 'answer', sdp: answer },
          })
        }
        break

      case 'answer':
        if (payload.sdp) {
          await pc.setRemoteDescription(payload.sdp)
        }
        break

      case 'ice':
        if (payload.candidate) {
          await pc.addIceCandidate(payload.candidate)
        }
        break
    }
  }

  /**
   * Set up data channel handlers
   */
  private setupDataChannel(peerConn: PeerConnection): void {
    const { dc, peerId } = peerConn
    if (!dc) return

    dc.onopen = () => {
      // Request initial sync
      this.requestSync(peerId)
    }

    dc.onmessage = (event) => {
      this.handleSyncMessage(peerId, event.data)
    }

    dc.onclose = () => {
      this.handlePeerLeave(peerId)
    }
  }

  /**
   * Handle peer connection established
   */
  private handlePeerConnected(peerId: string): void {
    const store = useSyncStore.getState()
    store.addPeer({
      id: peerId,
      name: 'Device',
      lastSeen: new Date(),
      isOnline: true,
    })
  }

  /**
   * Handle peer disconnection
   */
  private handlePeerLeave(peerId: string): void {
    const peerConn = this.peers.get(peerId)
    if (peerConn) {
      peerConn.dc?.close()
      peerConn.pc.close()
      this.peers.delete(peerId)
    }

    useSyncStore.getState().removePeer(peerId)
  }

  /**
   * Send a sync message to a peer
   */
  private sendSyncMessage(peerId: string, message: SyncMessage): void {
    const peerConn = this.peers.get(peerId)
    if (peerConn?.dc?.readyState === 'open') {
      peerConn.dc.send(JSON.stringify(message))
    }
  }

  /**
   * Broadcast a sync message to all peers
   */
  broadcastSyncMessage(message: SyncMessage): void {
    for (const [peerId] of this.peers) {
      this.sendSyncMessage(peerId, message)
    }
  }

  /**
   * Request full sync from a peer
   */
  private requestSync(peerId: string): void {
    const message: SyncMessage = {
      type: 'sync_request',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }
    this.sendSyncMessage(peerId, message)
  }

  /**
   * Handle incoming sync message
   */
  private async handleSyncMessage(
    peerId: string,
    data: string
  ): Promise<void> {
    try {
      const message = JSON.parse(data) as SyncMessage

      switch (message.type) {
        case 'sync_request':
          await this.sendFullSync(peerId)
          break

        case 'sync_response':
          await this.applyFullSync(message.data as Record<string, unknown[]>)
          break

        case 'change':
          if (message.table && message.recordId && message.data) {
            await this.applyChange(
              message.table,
              message.recordId,
              message.data,
              message.timestamp
            )
          }
          break

        case 'delete':
          if (message.table && message.recordId) {
            await this.applyDelete(
              message.table,
              message.recordId,
              message.timestamp
            )
          }
          break

        case 'ack':
          // Acknowledgment received, no action needed
          break
      }
    } catch {
      // Invalid message, ignore
    }
  }

  /**
   * Send full database sync to a peer
   */
  private async sendFullSync(peerId: string): Promise<void> {
    const store = useSyncStore.getState()
    store.setStatus('syncing')

    const data: Record<string, unknown[]> = {}

    // Collect all syncable data
    for (const table of Object.keys(SYNC_TABLES) as SyncableTable[]) {
      try {
        const records = await (db[table] as Dexie.Table).toArray()
        data[table] = records
      } catch {
        // Table might not exist, skip
      }
    }

    const message: SyncMessage = {
      type: 'sync_response',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      data,
    }

    this.sendSyncMessage(peerId, message)
    store.setStatus('connected')
  }

  /**
   * Apply full sync data from a peer
   */
  private async applyFullSync(
    data: Record<string, unknown[]>
  ): Promise<void> {
    const store = useSyncStore.getState()
    store.setStatus('syncing')

    for (const [table, records] of Object.entries(data)) {
      if (!SYNC_TABLES[table as SyncableTable]) continue

      try {
        const dbTable = db[table as keyof typeof db] as Dexie.Table

        for (const record of records) {
          const existing = await dbTable.get((record as { id: string }).id)

          if (!existing) {
            // New record, add it
            await dbTable.add(record)
          } else {
            // Compare timestamps and keep newer
            const existingTime =
              (existing as { updatedAt?: Date }).updatedAt?.getTime() || 0
            const incomingTime =
              (record as { updatedAt?: Date }).updatedAt?.getTime() || 0

            if (incomingTime > existingTime) {
              await dbTable.put(record)
            }
          }
        }
      } catch {
        // Skip failed tables
      }
    }

    store.setLastSyncedAt(new Date())
    store.setStatus('connected')
  }

  /**
   * Apply a single change from a peer
   */
  private async applyChange(
    table: SyncableTable,
    recordId: string,
    data: unknown,
    timestamp: number
  ): Promise<void> {
    try {
      const dbTable = db[table as keyof typeof db] as Dexie.Table
      const existing = await dbTable.get(recordId)

      if (!existing) {
        // New record
        await dbTable.add(data)
      } else {
        // Compare timestamps
        const existingTime =
          (existing as { updatedAt?: Date }).updatedAt?.getTime() || 0

        if (timestamp > existingTime) {
          await dbTable.put(data)
        }
      }

      useSyncStore.getState().setLastSyncedAt(new Date())
    } catch {
      // Failed to apply change
    }
  }

  /**
   * Apply a delete (archive) from a peer
   */
  private async applyDelete(
    table: SyncableTable,
    recordId: string,
    timestamp: number
  ): Promise<void> {
    try {
      const dbTable = db[table as keyof typeof db] as Dexie.Table
      const existing = await dbTable.get(recordId)

      if (existing) {
        const existingTime =
          (existing as { updatedAt?: Date }).updatedAt?.getTime() || 0

        if (timestamp > existingTime) {
          // Apply archive
          await dbTable.update(recordId, {
            archivedAt: new Date(timestamp),
            updatedAt: new Date(timestamp),
          })
        }
      }

      useSyncStore.getState().setLastSyncedAt(new Date())
    } catch {
      // Failed to apply delete
    }
  }

  /**
   * Notify peers of a local change
   */
  async notifyChange(
    table: SyncableTable,
    recordId: string,
    data: unknown
  ): Promise<void> {
    if (this.peers.size === 0) return

    const message: SyncMessage = {
      type: 'change',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      table,
      recordId,
      data,
    }

    this.broadcastSyncMessage(message)
  }

  /**
   * Notify peers of a local deletion
   */
  async notifyDelete(table: SyncableTable, recordId: string): Promise<void> {
    if (this.peers.size === 0) return

    const message: SyncMessage = {
      type: 'delete',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      table,
      recordId,
    }

    this.broadcastSyncMessage(message)
  }

  /**
   * Check if connected to any peers
   */
  isConnected(): boolean {
    return this.peers.size > 0
  }

  /**
   * Get connected peer count
   */
  getPeerCount(): number {
    return this.peers.size
  }
}

// Singleton instance
export const syncProvider = new SyncProvider()
