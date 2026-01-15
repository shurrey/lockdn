import type * as Party from 'partykit/server'

/**
 * Lockdn Signaling Server
 *
 * Handles WebRTC signaling for P2P sync between devices.
 * Each "room" represents a sync group identified by a pairing code.
 *
 * Protocol:
 * - Client connects, sends { type: 'hello', deviceId: '...' } first
 * - Server responds with { type: 'welcome', yourId: '...' }
 * - Then normal signaling: 'join', 'leave', 'signal', 'ping'
 */

interface SignalMessage {
  type: 'signal' | 'join' | 'leave' | 'ping' | 'hello'
  from?: string
  to?: string // Optional: direct message to specific peer
  payload?: unknown
  deviceId?: string
}

interface PeerInfo {
  id: string
  deviceId: string | null
  joinedAt: number
  announced: boolean
}

export default class SignalingServer implements Party.Server {
  // Track connected peers with their info
  // Key is connection ID, value has both connection ID and deviceId
  peers: Map<string, PeerInfo> = new Map()

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    // Store peer with connection ID, wait for hello message to get deviceId
    this.peers.set(conn.id, {
      id: conn.id,
      deviceId: null,
      joinedAt: Date.now(),
      announced: false,
    })

    // Send welcome with their assigned ID (use this if they don't send hello)
    conn.send(
      JSON.stringify({
        type: 'welcome',
        yourId: conn.id,
      })
    )
  }

  onClose(conn: Party.Connection) {
    const peer = this.peers.get(conn.id)
    if (peer && peer.announced) {
      // Use deviceId if available, otherwise connection ID
      const peerId = peer.deviceId || peer.id
      // Notify other peers about the disconnection
      this.broadcast(
        {
          type: 'leave',
          from: peerId,
        },
        conn.id
      )
    }
    this.peers.delete(conn.id)
  }

  onMessage(message: string, sender: Party.Connection) {
    const peer = this.peers.get(sender.id)
    if (!peer) return

    try {
      const data = JSON.parse(message) as SignalMessage

      // Handle ping/pong for keepalive
      if (data.type === 'ping') {
        sender.send(JSON.stringify({ type: 'pong' }))
        return
      }

      // Handle hello message - client announcing its deviceId
      if (data.type === 'hello' && data.deviceId) {
        peer.deviceId = data.deviceId
        peer.announced = true

        // Now send peer list and announce to others
        const peerId = peer.deviceId

        // Send current peer list to this connection
        const peerList = Array.from(this.peers.values())
          .filter((p) => p.id !== sender.id && p.announced)
          .map((p) => ({
            id: p.deviceId || p.id,
            joinedAt: p.joinedAt,
          }))

        sender.send(
          JSON.stringify({
            type: 'peers',
            peers: peerList,
          })
        )

        // Notify other peers about this new connection
        this.broadcast(
          {
            type: 'join',
            from: peerId,
            payload: { joinedAt: peer.joinedAt },
          },
          sender.id
        )
        return
      }

      // Use deviceId if available, otherwise connection ID
      const senderId = peer.deviceId || peer.id

      // Add sender info
      const outgoing = {
        ...data,
        from: senderId,
      }

      // If message has a specific target, send only to that peer
      if (data.to) {
        for (const [connId, peerInfo] of this.peers) {
          const targetId = peerInfo.deviceId || peerInfo.id
          if (targetId === data.to) {
            const conn = this.room.getConnection(connId)
            if (conn) {
              conn.send(JSON.stringify(outgoing))
            }
            break
          }
        }
      } else {
        // Broadcast to all other peers
        this.broadcast(outgoing, sender.id)
      }
    } catch {
      // Invalid JSON, ignore
    }
  }

  private broadcast(message: Partial<SignalMessage>, excludeConnId?: string) {
    const json = JSON.stringify(message)
    for (const [connId, peer] of this.peers) {
      if (connId !== excludeConnId && peer.announced) {
        const conn = this.room.getConnection(connId)
        if (conn) {
          conn.send(json)
        }
      }
    }
  }

  // Optional: Handle HTTP requests for room status
  async onRequest(req: Party.Request) {
    if (req.method === 'GET') {
      return new Response(
        JSON.stringify({
          room: this.room.id,
          peers: this.peers.size,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
    return new Response('Method not allowed', { status: 405 })
  }
}
