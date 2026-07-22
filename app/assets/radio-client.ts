import {
  NTP_CONSTANTS,
  parseServerMessage,
  type ClientInfo,
  type RoomSnapshot,
  type ServerMessage,
  type Track,
} from '../data/protocol.ts'
import { audioContextManager } from './audio-context.ts'
import {
  calculateOffsetEstimate,
  calculateWaitTimeMilliseconds,
  handleNtpResponse,
  resetProbeState,
  sendProbePair,
  type NtpMeasurement,
} from './radio-sync.ts'
import { getWsUrl } from './urls.ts'

export interface RadioClientState {
  connected: boolean
  synced: boolean
  offsetMs: number
  rttMs: number
  tracks: Track[]
  clients: ClientInfo[]
  currentTrackId: string | null
  playing: boolean
  positionSeconds: number
  durationSeconds: number
  volume: number
  status: string
}

interface RadioAudioManager {
  resume(): Promise<void>
  setMasterGain(value: number, rampTime?: number): void
  decodeAudioData(buffer: ArrayBuffer): Promise<AudioBuffer>
  createBufferSource(): AudioBufferSourceNode
  getContext(): AudioContext
  getInputNode(): AudioNode
}

export class RadioClient extends EventTarget {
  private socket: WebSocket | null = null
  private measurements: NtpMeasurement[] = []
  private heartbeatTimer: number | null = null
  private buffers = new Map<string, AudioBuffer>()
  private sourceNode: AudioBufferSourceNode | null = null
  private playbackStartTime = 0
  private playbackOffset = 0
  private currentTime = 0
  private reconnectTimer: number | null = null
  private progressTimer: number | null = null

  state: RadioClientState

  private readonly audio: RadioAudioManager

  constructor(
    private readonly options: {
      initialSnapshot: RoomSnapshot
      clientId: string
      name: string
      audioManager?: RadioAudioManager
    },
  ) {
    super()
    this.audio = options.audioManager ?? audioContextManager
    this.state = {
      connected: false,
      synced: false,
      offsetMs: 0,
      rttMs: 0,
      tracks: options.initialSnapshot.tracks,
      clients: options.initialSnapshot.clients,
      currentTrackId: options.initialSnapshot.playback.trackId,
      playing: options.initialSnapshot.playback.type === 'playing',
      positionSeconds: options.initialSnapshot.playback.trackTimeSeconds,
      durationSeconds: 0,
      volume: options.initialSnapshot.volume,
      status: 'Idle',
    }
    this.currentTime = options.initialSnapshot.playback.trackTimeSeconds
    this.audio.setMasterGain(this.state.volume, 0)
  }

  onState(listener: (state: RadioClientState) => void, options?: boolean | AddEventListenerOptions): void {
    super.addEventListener('state', (event) => listener((event as CustomEvent<RadioClientState>).detail), options)
  }

  async wakeAudio(): Promise<void> {
    await this.audio.resume()
    this.setStatus('Audio awake')
  }

  connect(): void {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return
    this.socket = new WebSocket(getWsUrl())
    this.socket.addEventListener('open', () => {
      this.setState({ connected: true, status: 'Connected' })
      this.send({ type: 'JOIN', clientId: this.options.clientId, name: this.options.name })
      this.startHeartbeat()
    })
    this.socket.addEventListener('message', (event) => {
      let message = parseServerMessage(String(event.data))
      if (message) void this.handleMessage(message)
    })
    this.socket.addEventListener('close', () => {
      this.stopHeartbeat()
      this.setState({ connected: false, synced: false, status: 'Disconnected. Reconnecting...' })
      this.scheduleReconnect()
    })
  }

  dispose(): void {
    this.stopHeartbeat()
    this.stopProgressTimer()
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer)
    this.socket?.close()
  }

  play(trackId?: string): void {
    let nextTrackId = trackId ?? this.state.currentTrackId ?? this.state.tracks[0]?.id
    if (!nextTrackId) return
    let trackTimeSeconds = nextTrackId === this.state.currentTrackId ? this.getCurrentTrackPosition() : 0
    this.send({ type: 'PLAY', trackId: nextTrackId, trackTimeSeconds })
  }

  pause(): void {
    let trackId = this.state.currentTrackId
    if (!trackId) return
    this.send({ type: 'PAUSE', trackId, trackTimeSeconds: this.getCurrentTrackPosition() })
  }

  removeTrack(trackId: string): void {
    this.send({ type: 'REMOVE_TRACK', trackId })
  }

  setVolume(volume: number): void {
    this.send({ type: 'SET_VOLUME', volume })
  }

  syncNow(): void {
    this.setStatus('Syncing clock...')
    this.sendProbePair()
  }

  seek(trackTimeSeconds: number): void {
    let trackId = this.state.currentTrackId
    if (!trackId) return
    let boundedTime = this.boundTrackTime(trackTimeSeconds)
    this.currentTime = boundedTime
    this.setState({ positionSeconds: boundedTime })
    if (this.state.playing) {
      this.send({ type: 'PLAY', trackId, trackTimeSeconds: boundedTime })
    } else {
      this.send({ type: 'PAUSE', trackId, trackTimeSeconds: boundedTime })
    }
  }

  async upload(file: File): Promise<void> {
    let form = new FormData()
    form.set('track', file)
    this.setStatus(`Uploading ${file.name}...`)
    let response = await fetch('/tracks', { method: 'POST', body: form })
    if (!response.ok) {
      let body = (await response.json().catch(() => null)) as { error?: string } | null
      throw new Error(body?.error ?? 'Upload failed')
    }
    this.setStatus('Upload complete')
  }

  private async handleMessage(message: ServerMessage): Promise<void> {
    switch (message.type) {
      case 'ROOM_STATE':
        this.setState({
          tracks: message.snapshot.tracks,
          clients: message.snapshot.clients,
          currentTrackId: message.snapshot.playback.trackId,
          playing: message.snapshot.playback.type === 'playing',
          positionSeconds: message.snapshot.playback.trackTimeSeconds,
          volume: message.snapshot.volume,
        })
        this.currentTime = message.snapshot.playback.trackTimeSeconds
        this.audio.setMasterGain(message.snapshot.volume, 0)
        break
      case 'PRESENCE':
        this.setState({ clients: message.clients })
        break
      case 'QUEUE_UPDATED':
        this.setState({ tracks: message.tracks })
        break
      case 'NTP_RESPONSE': {
        let measurement = handleNtpResponse(message)
        if (!measurement) return
        this.measurements = [...this.measurements.slice(-NTP_CONSTANTS.MAX_MEASUREMENTS + 1), measurement]
        let estimate = calculateOffsetEstimate(this.measurements)
        this.setState({
          synced: this.measurements.length >= NTP_CONSTANTS.MAX_MEASUREMENTS,
          offsetMs: estimate.offset,
          rttMs: estimate.roundTrip,
        })
        break
      }
      case 'LOAD_TRACK':
        await this.loadTrack(message.track)
        this.send({ type: 'TRACK_READY', trackId: message.track.id })
        break
      case 'SCHEDULED_PLAY':
        await this.schedulePlay(message.trackId, message.trackTimeSeconds, message.serverTimeToExecute)
        break
      case 'SCHEDULED_PAUSE':
        this.schedulePause(message.trackId, message.trackTimeSeconds, message.serverTimeToExecute)
        break
      case 'VOLUME_UPDATED':
        this.setState({ volume: message.volume })
        this.audio.setMasterGain(message.volume, 0.1)
        break
      case 'LIVENESS_PING':
        this.send({ type: 'LIVENESS_PONG' })
        this.sendProbePair()
        break
      case 'ERROR':
        this.setStatus(message.message)
        break
    }
  }

  private async loadTrack(track: Track): Promise<AudioBuffer | null> {
    let cached = this.buffers.get(track.id)
    if (cached) {
      if (track.id === this.state.currentTrackId) this.setState({ durationSeconds: cached.duration })
      return cached
    }
    this.setStatus(`Loading ${track.title}...`)
    let response = await fetch(track.url)
    if (!response.ok) return null
    let buffer = await this.audio.decodeAudioData(await response.arrayBuffer())
    this.buffers.set(track.id, buffer)
    if (track.id === this.state.currentTrackId) this.setState({ durationSeconds: buffer.duration })
    this.setStatus(`Loaded ${track.title}`)
    return buffer
  }

  private async schedulePlay(trackId: string, trackTimeSeconds: number, targetServerTime: number): Promise<void> {
    let track = this.state.tracks.find((candidate) => candidate.id === trackId)
    if (!track) return
    let buffer = await this.loadTrack(track)
    if (!buffer) return
    await this.audio.resume()

    let context = this.audio.getContext()
    let waitSeconds = calculateWaitTimeMilliseconds(targetServerTime, this.state.offsetMs) / 1000
    let startTime = context.currentTime + Math.max(0, waitSeconds)
    let boundedOffset = Math.max(0, Math.min(trackTimeSeconds, buffer.duration - 0.01))

    this.stopSource()
    let source = this.audio.createBufferSource()
    source.buffer = buffer
    source.connect(this.audio.getInputNode())
    source.start(startTime, boundedOffset)
    source.onended = () => {
      if (this.sourceNode === source) {
        this.stopProgressTimer()
        this.setState({ playing: false, positionSeconds: this.state.durationSeconds })
      }
    }

    this.sourceNode = source
    this.playbackStartTime = startTime
    this.playbackOffset = boundedOffset
    this.currentTime = boundedOffset
    this.setState({
      currentTrackId: trackId,
      playing: true,
      positionSeconds: boundedOffset,
      durationSeconds: buffer.duration,
      status: `Playing ${track.title}`,
    })
    this.startProgressTimer()
  }

  private schedulePause(trackId: string, trackTimeSeconds: number, targetServerTime: number): void {
    let waitSeconds = calculateWaitTimeMilliseconds(targetServerTime, this.state.offsetMs) / 1000
    let context = this.audio.getContext()
    let stopTime = context.currentTime + Math.max(0, waitSeconds)
    try {
      if (this.sourceNode) this.sourceNode.onended = null
      this.sourceNode?.stop(stopTime)
      this.sourceNode?.disconnect()
    } catch {
      // Already stopped.
    }
    this.sourceNode = null
    this.currentTime = this.boundTrackTime(trackTimeSeconds)
    this.stopProgressTimer()
    this.setState({ currentTrackId: trackId, playing: false, positionSeconds: this.currentTime, status: 'Paused' })
  }

  private getCurrentTrackPosition(): number {
    if (!this.state.playing || !this.sourceNode) return this.currentTime
    let elapsed = this.audio.getContext().currentTime - this.playbackStartTime
    return this.boundTrackTime(this.playbackOffset + elapsed)
  }

  private boundTrackTime(trackTimeSeconds: number): number {
    let maxTime = this.state.durationSeconds > 0 ? Math.max(0, this.state.durationSeconds - 0.01) : Infinity
    return Math.max(0, Math.min(trackTimeSeconds, maxTime))
  }

  private stopSource(): void {
    if (!this.sourceNode) return
    try {
      this.sourceNode.onended = null
      this.sourceNode.disconnect()
      this.sourceNode.stop()
    } catch {
      // Already stopped.
    }
    this.sourceNode = null
  }

  private startProgressTimer(): void {
    this.stopProgressTimer()
    this.progressTimer = window.setInterval(() => {
      let positionSeconds = this.getCurrentTrackPosition()
      this.currentTime = positionSeconds
      this.setState({ positionSeconds })
    }, 250)
  }

  private stopProgressTimer(): void {
    if (this.progressTimer) window.clearInterval(this.progressTimer)
    this.progressTimer = null
  }

  private startHeartbeat(): void {
    resetProbeState()
    this.measurements = []
    this.stopHeartbeat()
    let tick = () => {
      this.sendProbePair()
      let interval = this.measurements.length < NTP_CONSTANTS.MAX_MEASUREMENTS
        ? NTP_CONSTANTS.INITIAL_INTERVAL_MS
        : NTP_CONSTANTS.STEADY_STATE_INTERVAL_MS
      this.heartbeatTimer = window.setTimeout(tick, interval)
    }
    tick()
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) window.clearTimeout(this.heartbeatTimer)
    this.heartbeatTimer = null
  }

  private sendProbePair(): void {
    sendProbePair({
      send: (value) => this.send(value),
      currentRTT: this.state.rttMs || undefined,
      compensationMs: 0,
      nudgeMs: 0,
    })
  }

  private send(value: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(value))
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, 1000)
  }

  private setStatus(status: string): void {
    this.setState({ status })
  }

  private setState(patch: Partial<RadioClientState>): void {
    this.state = { ...this.state, ...patch }
    this.dispatchEvent(new CustomEvent('state', { detail: this.state }))
  }
}
