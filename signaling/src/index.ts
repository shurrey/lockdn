import type * as Party from 'partykit/server'

/**
 * Lockdn Signaling Server
 *
 * Handles WebRTC signaling for P2P sync between devices.
 * Each "room" represents a sync group identified by a pairing code.
 *
 * Protocol:
 * - Clients send JSON messages with { type, payload }
 * - Server broadcasts to all other clients in the room
 * - Special types: 'join', 'leave', 'signal'
 */

interface SignalMessage {
  type: 'signal' | 'join' | 'leave' | 'ping'
  from: string
  to?: string // Optional: direct message to specific peer
  payload?: unknown
}

interface PeerInfo {
  id: string
  joinedAt: number
}

export default class SignalingServer implements Party.Server {
  // Track connected peers with their info
  peers: Map<string, PeerInfo> = new Map()

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // Generate or use provided peer ID
    const peerId = ctx.request.headers.get('x-peer-id') || conn.id

    // Store peer info
    this.peers.set(conn.id, {
      id: peerId,
      joinedAt: Date.now(),
    })

    // Send current peer list to the new connection
    const peerList = Array.from(this.peers.values()).filter(
      (p) => p.id !== peerId
    )
    conn.send(
      JSON.stringify({
        type: 'peers',
        peers: peerList,
      })
    )

    // Notify other peers about the new connection
    this.broadcast(
      {
        type: 'join',
        from: peerId,
        payload: { joinedAt: Date.now() },
      },
      conn.id
    )
  }

  onClose(conn: Party.Connection) {
    const peer = this.peers.get(conn.id)
    if (peer) {
      // Notify other peers about the disconnection
      this.broadcast(
        {
          type: 'leave',
          from: peer.id,
        },
        conn.id
      )
      this.peers.delete(conn.id)
    }
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

      // Add sender info
      const outgoing = {
        ...data,
        from: peer.id,
      }

      // If message has a specific target, send only to that peer
      if (data.to) {
        for (const [connId, peerInfo] of this.peers) {
          if (peerInfo.id === data.to) {
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

  private broadcast(message: SignalMessage, excludeConnId?: string) {
    const json = JSON.stringify(message)
    for (const [connId] of this.peers) {
      if (connId !== excludeConnId) {
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
