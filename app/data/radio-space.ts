import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import {
  ROOM_ID,
  encodeServerMessage,
  epochNow,
  type ClientInfo,
  type PlaybackState,
  type RoomSnapshot,
  type ServerMessage,
  type Track,
} from './protocol.ts'
import { calculateScheduleTimeMs, DEFAULT_CLIENT_RTT_MS } from './timing.ts'

export interface RadioSocket {
  send(data: string): void
  close(): void
  terminate(): void
  readyState: number
}

interface ConnectedClient {
  socket: RadioSocket
  info: ClientInfo
}

interface PendingPlay {
  trackId: string
  trackTimeSeconds: number
  loadedClientIds: Set<string>
  timer: ReturnType<typeof setTimeout>
}

interface PersistedState {
  tracks: Track[]
  playback: PlaybackState
  volume: number
}

const defaultStatePath = path.join(process.cwd(), 'tmp', 'radio-state.json')
const DEFAULT_AUDIO_LOAD_TIMEOUT_MS = 3000
const DEFAULT_LIVENESS_PING_AFTER_MS = 15_000
const DEFAULT_LIVENESS_REAP_AFTER_MS = 60_000
const DEFAULT_HEARTBEAT_INTERVAL_MS = 2500

interface RadioSpaceOptions {
  statePath?: string
  persist?: boolean
  audioLoadTimeoutMs?: number
  livenessPingAfterMs?: number
  livenessReapAfterMs?: number
  heartbeatIntervalMs?: number
}

const initialPlayback: PlaybackState = {
  type: 'paused',
  trackId: null,
  trackTimeSeconds: 0,
  serverTimeToExecute: 0,
}

export class RadioSpace {
  private tracks: Track[] = []
  private clients = new Map<string, ConnectedClient>()
  private playback: PlaybackState = initialPlayback
  private volume = 1
  private pendingPlay: PendingPlay | null = null
  private heartbeat: ReturnType<typeof setInterval> | null = null
  private loadPromise: Promise<void> | null = null

  constructor(private readonly options: RadioSpaceOptions = {}) {}

  async load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise
    this.loadPromise = this.loadState()
    return this.loadPromise
  }

  connect(socket: RadioSocket, data: { clientId: string; name: string }): void {
    let existingConnection = this.clients.get(data.clientId)
    let existing = existingConnection?.info
    let info: ClientInfo = {
      clientId: data.clientId,
      name: data.name || existing?.name || 'Someone',
      rtt: existing?.rtt ?? 0,
      compensationMs: existing?.compensationMs ?? 0,
      nudgeMs: existing?.nudgeMs ?? 0,
      joinedAt: existing?.joinedAt ?? Date.now(),
      lastSeenAt: Date.now(),
    }

    if (existingConnection && existingConnection.socket !== socket) {
      existingConnection.socket.close()
    }
    this.clients.set(data.clientId, { socket, info })
    this.startHeartbeat()
    this.send(socket, { type: 'ROOM_STATE', snapshot: this.snapshot() })
    this.broadcastPresence()

    if (this.playback.type === 'playing' && this.playback.trackId) {
      this.syncLateClient(socket)
    }
  }

  disconnect(clientId: string, socket: RadioSocket): void {
    let connected = this.clients.get(clientId)
    if (connected?.socket !== socket) return
    this.dropClient(clientId)
  }

  private dropClient(clientId: string): void {
    this.clients.delete(clientId)
    if (this.pendingPlay) {
      this.pendingPlay.loadedClientIds.delete(clientId)
      this.maybeFlushPendingPlay()
    }
    if (this.clients.size === 0) this.stopHeartbeat()
    this.broadcastPresence()
  }

  markSeen(clientId: string): void {
    let client = this.clients.get(clientId)
    if (client) client.info.lastSeenAt = Date.now()
  }

  processNtp(
    clientId: string,
    data: { clientRTT?: number; clientCompensationMs?: number; clientNudgeMs?: number },
  ): void {
    let client = this.clients.get(clientId)
    if (!client) return

    if (data.clientRTT !== undefined && data.clientRTT > 0) {
      let alpha = 0.2
      client.info.rtt = client.info.rtt > 0 ? client.info.rtt * (1 - alpha) + data.clientRTT * alpha : data.clientRTT
    }
    if (data.clientCompensationMs !== undefined && data.clientCompensationMs >= 0) {
      client.info.compensationMs = data.clientCompensationMs
    }
    if (data.clientNudgeMs !== undefined) {
      client.info.nudgeMs = data.clientNudgeMs
    }
  }

  async addTrack(track: Track): Promise<void> {
    this.tracks.push(track)
    await this.saveState()
    this.broadcast({ type: 'QUEUE_UPDATED', tracks: this.tracks })
  }

  async removeTrack(trackId: string): Promise<void> {
    let track = this.tracks.find((candidate) => candidate.id === trackId)
    this.tracks = this.tracks.filter((candidate) => candidate.id !== trackId)

    if (this.playback.trackId === trackId) {
      this.playback = initialPlayback
    }
    if (this.pendingPlay?.trackId === trackId) {
      clearTimeout(this.pendingPlay.timer)
      this.pendingPlay = null
    }

    if (track?.url.startsWith('/uploads/')) {
      let filename = path.basename(track.url)
      await fs.rm(path.join(process.cwd(), 'public', 'uploads', filename), { force: true })
    }

    await this.saveState()
    this.broadcast({ type: 'QUEUE_UPDATED', tracks: this.tracks })
    this.broadcast({ type: 'ROOM_STATE', snapshot: this.snapshot() })
  }

  async reorderTracks(trackIds: string[]): Promise<void> {
    let byId = new Map(this.tracks.map((track) => [track.id, track]))
    if (trackIds.length !== this.tracks.length || trackIds.some((id) => !byId.has(id))) return
    this.tracks = trackIds.map((id) => byId.get(id)!)
    await this.saveState()
    this.broadcast({ type: 'QUEUE_UPDATED', tracks: this.tracks })
  }

  requestPlay(clientId: string, trackId: string, trackTimeSeconds: number): void {
    let track = this.tracks.find((candidate) => candidate.id === trackId)
    if (!track) {
      this.sendError(clientId, 'Track no longer exists')
      return
    }

    this.clearPendingPlay()
    let timer = setTimeout(
      () => this.flushPendingPlay(),
      this.options.audioLoadTimeoutMs ?? DEFAULT_AUDIO_LOAD_TIMEOUT_MS,
    )
    this.pendingPlay = {
      trackId,
      trackTimeSeconds: Math.max(0, trackTimeSeconds),
      loadedClientIds: new Set([clientId]),
      timer,
    }
    this.broadcast({ type: 'LOAD_TRACK', track })
    this.maybeFlushPendingPlay()
  }

  markTrackReady(clientId: string, trackId: string): void {
    if (!this.pendingPlay || this.pendingPlay.trackId !== trackId) return
    this.pendingPlay.loadedClientIds.add(clientId)
    this.maybeFlushPendingPlay()
  }

  async requestPause(trackId: string, trackTimeSeconds: number): Promise<void> {
    if (!this.tracks.some((track) => track.id === trackId)) return
    let serverTimeToExecute = this.getScheduledExecutionTime()
    this.playback = {
      type: 'paused',
      trackId,
      trackTimeSeconds: Math.max(0, trackTimeSeconds),
      serverTimeToExecute,
    }
    await this.saveState()
    this.broadcast({
      type: 'SCHEDULED_PAUSE',
      trackId,
      trackTimeSeconds: this.playback.trackTimeSeconds,
      serverTimeToExecute,
    })
  }

  async setVolume(volume: number): Promise<void> {
    this.volume = Math.max(0, Math.min(1, volume))
    await this.saveState()
    this.broadcast({ type: 'VOLUME_UPDATED', volume: this.volume })
  }

  snapshot(): RoomSnapshot {
    return {
      roomId: ROOM_ID,
      tracks: this.tracks,
      clients: Array.from(this.clients.values()).map((client) => client.info),
      playback: this.playback,
      volume: this.volume,
    }
  }

  private async loadState(): Promise<void> {
    if (this.options.persist === false) return
    try {
      let raw = await fs.readFile(this.options.statePath ?? defaultStatePath, 'utf8')
      let parsed = JSON.parse(raw) as Partial<PersistedState>
      this.tracks = Array.isArray(parsed.tracks) ? parsed.tracks : []
      this.playback = parsed.playback ?? initialPlayback
      this.volume = typeof parsed.volume === 'number' ? parsed.volume : 1
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.error('Failed to load radio state', error)
    }
  }

  private async saveState(): Promise<void> {
    if (this.options.persist === false) return
    let statePath = this.options.statePath ?? defaultStatePath
    await fs.mkdir(path.dirname(statePath), { recursive: true })
    let state: PersistedState = {
      tracks: this.tracks,
      playback: this.playback,
      volume: this.volume,
    }
    await fs.writeFile(statePath, JSON.stringify(state, null, 2))
  }

  private getScheduledExecutionTime(): number {
    let maxRtt = DEFAULT_CLIENT_RTT_MS
    let maxCompensation = 0
    for (let client of this.clients.values()) {
      if (client.info.rtt > maxRtt) maxRtt = client.info.rtt
      if (client.info.compensationMs > maxCompensation) maxCompensation = client.info.compensationMs
    }
    return epochNow() + Math.max(calculateScheduleTimeMs(maxRtt), maxCompensation + 200)
  }

  private maybeFlushPendingPlay(): void {
    if (!this.pendingPlay) return
    if (this.pendingPlay.loadedClientIds.size >= this.clients.size) this.flushPendingPlay()
  }

  private async flushPendingPlay(): Promise<void> {
    if (!this.pendingPlay) return
    let pending = this.pendingPlay
    this.pendingPlay = null
    clearTimeout(pending.timer)

    let serverTimeToExecute = this.getScheduledExecutionTime()
    this.playback = {
      type: 'playing',
      trackId: pending.trackId,
      trackTimeSeconds: pending.trackTimeSeconds,
      serverTimeToExecute,
    }
    await this.saveState()
    this.broadcast({
      type: 'SCHEDULED_PLAY',
      trackId: pending.trackId,
      trackTimeSeconds: pending.trackTimeSeconds,
      serverTimeToExecute,
    })
  }

  private clearPendingPlay(): void {
    if (!this.pendingPlay) return
    clearTimeout(this.pendingPlay.timer)
    this.pendingPlay = null
  }

  private syncLateClient(socket: RadioSocket): void {
    if (this.playback.type !== 'playing' || !this.playback.trackId) return
    let serverTimeToExecute = this.getScheduledExecutionTime() + 1500
    let elapsedAtExecution = serverTimeToExecute - this.playback.serverTimeToExecute
    this.send(socket, {
      type: 'SCHEDULED_PLAY',
      trackId: this.playback.trackId,
      trackTimeSeconds: this.playback.trackTimeSeconds + elapsedAtExecution / 1000,
      serverTimeToExecute,
    })
  }

  private broadcastPresence(): void {
    this.broadcast({ type: 'PRESENCE', clients: this.snapshot().clients })
  }

  private broadcast(message: ServerMessage): void {
    let encoded = encodeServerMessage(message)
    for (let client of this.clients.values()) {
      client.socket.send(encoded)
    }
  }

  private send(socket: RadioSocket, message: ServerMessage): void {
    socket.send(encodeServerMessage(message))
  }

  private sendError(clientId: string, message: string): void {
    let client = this.clients.get(clientId)
    if (client) this.send(client.socket, { type: 'ERROR', message })
  }

  private startHeartbeat(): void {
    if (this.heartbeat) return
    this.heartbeat = setInterval(() => {
      let now = Date.now()
      for (let [clientId, client] of this.clients.entries()) {
        let silentMs = now - client.info.lastSeenAt
        if (silentMs > (this.options.livenessReapAfterMs ?? DEFAULT_LIVENESS_REAP_AFTER_MS)) {
          client.socket.terminate()
          this.dropClient(clientId)
        } else if (silentMs > (this.options.livenessPingAfterMs ?? DEFAULT_LIVENESS_PING_AFTER_MS)) {
          this.send(client.socket, { type: 'LIVENESS_PING' })
        }
      }
    }, this.options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS)
  }

  private stopHeartbeat(): void {
    if (!this.heartbeat) return
    clearInterval(this.heartbeat)
    this.heartbeat = null
  }
}

export const radioSpace = new RadioSpace()
