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

// Chunk message for reassembly
interface ChunkMessage {
  type: 'chunk'
  messageId: string
  chunkIndex: number
  totalChunks: number
  data: string
}

// Pending chunks waiting for reassembly
interface PendingChunks {
  chunks: Map<number, string>
  totalChunks: number
  receivedAt: number
}

class SyncProvider {
  private ws: WebSocket | null = null
  private peers: Map<string, PeerConnection> = new Map()
  private roomId: string | null = null
  private pairingSecret: string | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private pendingChunks: Map<string, PendingChunks> = new Map()

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

      try {
        this.ws = new WebSocket(url)

        this.ws.onopen = () => {
          // Send hello message with our deviceId so server uses consistent IDs
          const deviceId = store.deviceId
          this.sendSignal({ type: 'hello', deviceId } as Partial<SignalMessage>)
          store.setStatus('connected')
          this.startPing()
          resolve()
        }

        this.ws.onclose = () => {
          this.handleDisconnect()
        }

        this.ws.onerror = (error) => {
          console.error('[Sync] WebSocket error:', error)
          store.setError('Failed to connect to sync server')
          reject(error)
        }

        this.ws.onmessage = (event) => {
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
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    for (const [, peer] of this.peers) {
      peer.dc?.close()
      peer.pc.close()
    }
    this.peers.clear()

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.roomId = null
    this.pairingSecret = null

    useSyncStore.getState().reset()
  }

  /**
   * Disconnect a specific peer
   */
  disconnectPeer(peerId: string): void {
    this.handlePeerLeave(peerId)
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnect(): void {
    const store = useSyncStore.getState()
    store.setStatus('disconnected')

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
          if (message.peers) {
            for (const peer of message.peers) {
              await this.initiatePeerConnection(peer.id)
            }
          }
          break

        case 'join':
          if (message.from) {
            await this.initiatePeerConnection(message.from)
          }
          break

        case 'leave':
          if (message.from) {
            this.handlePeerLeave(message.from)
          }
          break

        case 'signal':
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
        case 'welcome':
          // Ignore keepalive and welcome messages
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
      peerConn.dc = event.channel
      this.setupDataChannel(peerConn)
    }

    this.peers.set(peerId, peerConn)

    // Lower ID initiates the connection
    const deviceId = useSyncStore.getState().deviceId
    if (deviceId && deviceId < peerId) {
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
      this.requestSync(peerId)
    }

    dc.onmessage = (event) => {
      const data = event.data as string

      // Check if this is a chunk message
      try {
        const parsed = JSON.parse(data)
        if (parsed.type === 'chunk') {
          this.handleChunk(peerId, parsed as ChunkMessage)
          return
        }
      } catch {
        // Not JSON or not a chunk, continue to normal handling
      }

      this.handleSyncMessage(peerId, data)
    }

    dc.onclose = () => {
      this.handlePeerLeave(peerId)
    }

    dc.onerror = (error) => {
      console.error('[Sync] Data channel error:', error)
    }
  }

  /**
   * Handle incoming chunk and reassemble when complete
   */
  private handleChunk(peerId: string, chunk: ChunkMessage): void {
    const { messageId, chunkIndex, totalChunks, data } = chunk

    let pending = this.pendingChunks.get(messageId)
    if (!pending) {
      pending = {
        chunks: new Map(),
        totalChunks,
        receivedAt: Date.now(),
      }
      this.pendingChunks.set(messageId, pending)
    }

    pending.chunks.set(chunkIndex, data)

    if (pending.chunks.size === totalChunks) {
      let fullMessage = ''
      for (let i = 0; i < totalChunks; i++) {
        fullMessage += pending.chunks.get(i) || ''
      }

      this.pendingChunks.delete(messageId)
      this.handleSyncMessage(peerId, fullMessage)
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

  // Max chunk size (leave room for chunk metadata)
  private static readonly MAX_CHUNK_SIZE = 200000

  /**
   * Send a sync message to a peer (with chunking for large messages)
   */
  private sendSyncMessage(peerId: string, message: SyncMessage): void {
    const peerConn = this.peers.get(peerId)
    if (!peerConn?.dc || peerConn.dc.readyState !== 'open') {
      return
    }

    const json = JSON.stringify(message)

    // If message fits in one chunk, send directly
    if (json.length <= SyncProvider.MAX_CHUNK_SIZE) {
      try {
        peerConn.dc.send(json)
      } catch (err) {
        console.error('[Sync] Failed to send message:', err)
      }
      return
    }

    // Large message - split into chunks
    const messageId = crypto.randomUUID()
    const totalChunks = Math.ceil(json.length / SyncProvider.MAX_CHUNK_SIZE)

    for (let i = 0; i < totalChunks; i++) {
      const start = i * SyncProvider.MAX_CHUNK_SIZE
      const end = Math.min(start + SyncProvider.MAX_CHUNK_SIZE, json.length)
      const chunkData = json.slice(start, end)

      const chunk = {
        type: 'chunk',
        messageId,
        chunkIndex: i,
        totalChunks,
        data: chunkData,
      }

      try {
        peerConn.dc.send(JSON.stringify(chunk))
      } catch (err) {
        console.error('[Sync] Failed to send chunk:', err)
        return
      }
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
          break
      }
    } catch (err) {
      console.error('[Sync] Failed to handle sync message:', err)
    }
  }

  /**
   * Send full database sync to a peer
   */
  private async sendFullSync(peerId: string): Promise<void> {
    const store = useSyncStore.getState()
    store.setStatus('syncing')

    const data: Record<string, unknown[]> = {}

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
   * Get timestamp from a Date object or ISO string
   */
  private getTimestamp(value: Date | string | undefined | null): number {
    if (!value) return 0
    if (value instanceof Date) return value.getTime()
    if (typeof value === 'string') return new Date(value).getTime()
    return 0
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
            await dbTable.add(record)
          } else {
            const existingTime = this.getTimestamp(
              (existing as { updatedAt?: Date | string }).updatedAt
            )
            const incomingTime = this.getTimestamp(
              (record as { updatedAt?: Date | string }).updatedAt
            )

            if (incomingTime > existingTime) {
              await dbTable.put(record)
            }
          }
        }
      } catch (err) {
        console.error(`[Sync] Failed to apply records to ${table}:`, err)
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
        await dbTable.add(data)
      } else {
        const existingTime = this.getTimestamp(
          (existing as { updatedAt?: Date | string }).updatedAt
        )

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
        const existingTime = this.getTimestamp(
          (existing as { updatedAt?: Date | string }).updatedAt
        )

        if (timestamp > existingTime) {
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
