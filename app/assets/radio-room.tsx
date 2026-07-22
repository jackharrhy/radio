import { clientEntry, on, ref, type Handle, type SerializableProps, type SerializableValue } from 'remix/ui'

import type { RoomSnapshot, Track } from '../data/protocol.ts'
import { fitFontSize, fitText, getMaxTitleFontSize, getTextSurfaces, normalizeText } from './pretext-fit.ts'
import { RadioClient, type RadioClientState } from './radio-client.ts'
import {
  activeQueueItemStyle,
  brandStyle,
  contentStyle,
  controlBarStyle,
  dangerButtonStyle,
  emptyStyle,
  fileInputStyle,
  gateFormStyle,
  gateStyle,
  gateTitleStyle,
  iconButtonStyle,
  inputStyle,
  listenersStyle,
  listStyle,
  messageCardStyle,
  messageHeaderStyle,
  nowPlayingStyle,
  panelStyle,
  personStyle,
  playToggleStyle,
  primaryButtonStyle,
  queueIndexStyle,
  queueItemStyle,
  queueListStyle,
  queuePanelStyle,
  queueScrollStyle,
  queueTrackStyle,
  sectionHeaderStyle,
  seekStyle,
  shellStyle,
  statusPillStyle,
  statusStyle,
  titleBarStyle,
  topBarStyle,
  trackButtonStyle,
  trackMetaStyle,
  trackTitleStyle,
  transportReadoutStyle,
  transportStyle,
  uploadStyle,
  utilityTitleStyle,
  volumeStyle,
  windowStyle,
} from './radio-room-styles.ts'

interface RadioRoomProps extends SerializableProps {
  initialSnapshot: SerializableValue
}

export const RadioRoom = clientEntry(
  import.meta.url,
  function RadioRoom(handle: Handle<RadioRoomProps>) {
    let initialSnapshot = handle.props.initialSnapshot as unknown as RoomSnapshot
    let client: RadioClient | null = null
    let name = ''
    let nameInput = ''
    let trackInput: HTMLInputElement | null = null
    let viewportWidth = 960
    let state: RadioClientState = {
      connected: false,
      synced: false,
      offsetMs: 0,
      rttMs: 0,
      tracks: initialSnapshot.tracks,
      clients: initialSnapshot.clients,
      currentTrackId: initialSnapshot.playback.trackId,
      playing: initialSnapshot.playback.type === 'playing',
      positionSeconds: initialSnapshot.playback.trackTimeSeconds,
      durationSeconds: 0,
      volume: initialSnapshot.volume,
      status: 'Ready',
    }

    function start(nextName: string) {
      if (client) return
      name = nextName.trim()
      if (!name) return
      localStorage.setItem('radio.name', name)
      let clientId = getOrCreateClientId()
      client = new RadioClient({ initialSnapshot, clientId, name })
      client.onState((nextState) => {
        state = nextState
        handle.update()
      })
      client.connect()
      handle.update()
    }

    async function uploadSelectedTrack(input: HTMLInputElement) {
      if (!input.files?.[0]) return
      await client?.upload(input.files[0])
      input.value = ''
    }

    handle.queueTask((signal) => {
      let updateViewportWidth = () => {
        viewportWidth = document.documentElement.clientWidth || window.innerWidth
        handle.update()
      }
      updateViewportWidth()
      window.addEventListener('resize', updateViewportWidth)
      name = localStorage.getItem('radio.name')?.trim() ?? ''
      nameInput = name
      if (name) start(name)
      else handle.update()
      signal.addEventListener('abort', () => {
        window.removeEventListener('resize', updateViewportWidth)
        client?.dispose()
      })
    })

    return () => {
      if (!name) {
        return (
          <section mix={[windowStyle, gateStyle]}>
            <div mix={titleBarStyle}>cozy radio / identify</div>
            <div mix={messageCardStyle}>
              <header mix={messageHeaderStyle}>radio room</header>
              <h1 mix={gateTitleStyle}>ENTER THE ROOM</h1>
              <p mix={statusStyle}>Choose a name before joining the shared queue.</p>
            </div>
            <form
              mix={[
                gateFormStyle,
                on('submit', (event) => {
                  event.preventDefault()
                  start(nameInput)
                }),
              ]}
            >
              <input
                name="name"
                type="text"
                autocomplete="name"
                placeholder="your name"
                value={nameInput}
                mix={[
                  inputStyle,
                  on('input', (event) => {
                    nameInput = event.currentTarget.value
                    handle.update()
                  }),
                ]}
              />
              <button mix={primaryButtonStyle} type="submit">Join</button>
            </form>
          </section>
        )
      }

      let currentTrack = state.tracks.find((track) => track.id === state.currentTrackId) ?? null
      let surface = getTextSurfaces(viewportWidth)
      let currentTrackTitle = normalizeText(currentTrack?.title ?? 'No track loaded')
      let statusText = fitText(getPlaybackStatus(state, currentTrack), surface.status, 1)

      return (
          <section mix={[windowStyle, shellStyle]}>
            <header mix={[titleBarStyle, topBarStyle]}>
            <div mix={brandStyle}>
              <span>radio</span>
              <strong>{state.playing ? 'on air' : 'standby'}</strong>
            </div>
            <StatusPill state={state} />
          </header>

          <section mix={[panelStyle, nowPlayingStyle]}>
            <div mix={trackMetaStyle}>
              <header mix={messageHeaderStyle}>now</header>
              <FittedTitle text={currentTrackTitle} title={currentTrack?.title ?? undefined} fallbackWidth={surface.nowPlaying} />
              <p mix={statusStyle} title={state.status}>{statusText}</p>
            </div>
          </section>

          <div mix={contentStyle}>
            <section mix={[panelStyle, queuePanelStyle]}>
              <div mix={sectionHeaderStyle}>
                <h2>playlist</h2>
                <span>{state.tracks.length} tracks</span>
              </div>
              <div mix={uploadStyle}>
                <input
                  mix={[
                    fileInputStyle,
                    ref((node, signal) => {
                      trackInput = node
                      signal.addEventListener('abort', () => {
                        if (trackInput === node) trackInput = null
                      })
                    }),
                    on('change', (event) => void uploadSelectedTrack(event.currentTarget)),
                  ]}
                  hidden={true}
                  name="track"
                  type="file"
                  accept="audio/*,video/webm"
                />
                <button
                  mix={[
                    primaryButtonStyle,
                    on('click', (event) => {
                      event.preventDefault()
                      trackInput?.click()
                    }),
                  ]}
                  type="button"
                >
                  Add Track
                </button>
              </div>
              <div mix={queueScrollStyle}>
                <TrackList tracks={state.tracks} currentTrackId={state.currentTrackId} client={client} surface={surface.queueTrack} />
              </div>
            </section>

            <aside mix={[panelStyle, listenersStyle]}>
                <h2 mix={utilityTitleStyle}>listeners</h2>
                <ul mix={listStyle}>
                  {state.clients.map((person) => (
                    <li key={person.clientId} mix={personStyle}>
                      <span>{person.name}</span>
                      <small>{person.rtt ? `${Math.round(person.rtt)}ms` : 'sync'}</small>
                    </li>
                  ))}
                </ul>
            </aside>
          </div>

          <footer mix={controlBarStyle}>
            <div mix={transportStyle}>
              <button mix={[playToggleStyle, on('click', () => (state.playing ? client?.pause() : client?.play()))]} type="button" disabled={!state.tracks.length} aria-label={state.playing ? 'Pause' : 'Play'}>
                {state.playing ? 'Pause' : 'Play'}
              </button>
              <button mix={[iconButtonStyle, on('click', () => void client?.wakeAudio())]} type="button" aria-label="Wake audio">
                Wake
              </button>
              <button mix={[iconButtonStyle, on('click', () => client?.syncNow())]} type="button" disabled={!state.connected} aria-label="Sync playback">
                Sync
              </button>
              <div mix={transportReadoutStyle}>
                <span>{state.playing ? 'playing' : 'paused'}</span>
                <strong title={state.status}>{fitText(state.synced ? 'synced with room' : 'syncing with room', surface.transportStatus, 1)}</strong>
              </div>
            </div>
            <label mix={seekStyle}>
              <span>{formatTime(state.positionSeconds)}</span>
              <input
                type="range"
                min="0"
                max={String(Math.max(0, state.durationSeconds))}
                step="0.1"
                value={String(Math.min(state.positionSeconds, state.durationSeconds || state.positionSeconds))}
                disabled={!state.currentTrackId || state.durationSeconds <= 0}
                mix={on('change', (event) => client?.seek(event.currentTarget.valueAsNumber))}
              />
              <span>{state.durationSeconds > 0 ? formatTime(state.durationSeconds) : '--:--'}</span>
            </label>
            <label mix={volumeStyle}>
              <span>vol</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={String(state.volume)}
                mix={on('input', (event) => client?.setVolume(event.currentTarget.valueAsNumber))}
              />
              <span>{Math.round(state.volume * 100)}</span>
            </label>
          </footer>
        </section>
      )
    }
  },
)

function FittedTitle(handle: Handle<{ text: string; title?: string; fallbackWidth: number }>) {
  let width = handle.props.fallbackWidth

  return () => {
    let surfaceWidth = width || handle.props.fallbackWidth
    let fontSize = fitFontSize(handle.props.text, surfaceWidth, getMaxTitleFontSize(surfaceWidth), 6)

    return (
      <h1
        mix={[
          trackTitleStyle,
          ref((node, signal) => {
            let updateWidth = (nextWidth: number) => {
              let roundedWidth = Math.max(0, Math.floor(nextWidth))
              if (Math.abs(width - roundedWidth) < 2) return
              width = roundedWidth
              handle.update()
            }

            updateWidth(node.getBoundingClientRect().width)

            let observer = new ResizeObserver((entries) => {
              updateWidth(entries[0]?.contentRect.width ?? 0)
            })
            observer.observe(node)
            signal.addEventListener('abort', () => observer.disconnect())
          }),
        ]}
        title={handle.props.title}
        style={{ fontSize: `${fontSize}px`, lineHeight: `${fontSize}px` }}
      >
        {handle.props.text}
      </h1>
    )
  }
}

function TrackList(handle: Handle<{ tracks: Track[]; currentTrackId: string | null; client: RadioClient | null; surface: number }>) {
  return () => {
    if (handle.props.tracks.length === 0) {
      return <p mix={emptyStyle}>Upload the first track. Everyone in the room shares this queue.</p>
    }

    return (
      <ol mix={queueListStyle}>
        {handle.props.tracks.map((track, index) => {
          let active = track.id === handle.props.currentTrackId
          return (
            <li key={track.id} mix={[queueItemStyle, active ? activeQueueItemStyle : null]}>
              <button type="button" mix={[trackButtonStyle, on('click', () => handle.props.client?.play(track.id))]}>
                <span mix={queueIndexStyle}>{String(index + 1).padStart(2, '0')}</span>
                <span mix={queueTrackStyle} title={track.title}>{fitText(track.title, handle.props.surface, 1)}</span>
              </button>
              <button type="button" mix={[dangerButtonStyle, on('click', () => handle.props.client?.removeTrack(track.id))]} aria-label={`Remove ${track.title}`}>
                Remove
              </button>
            </li>
          )
        })}
      </ol>
    )
  }
}

function StatusPill(handle: Handle<{ state: RadioClientState }>) {
  return () => (
    <div mix={statusPillStyle}>
      <span>{handle.props.state.connected ? 'online' : 'offline'}</span>
      <span>{handle.props.state.synced ? 'synced' : 'syncing'}</span>
      <span>{Math.round(handle.props.state.rttMs)}ms</span>
    </div>
  )
}

function getOrCreateClientId(): string {
  let existing = localStorage.getItem('radio.clientId')
  if (existing) return existing
  let next = crypto.randomUUID()
  localStorage.setItem('radio.clientId', next)
  return next
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  let totalSeconds = Math.floor(seconds)
  let minutes = Math.floor(totalSeconds / 60)
  let remainingSeconds = totalSeconds % 60
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

function getPlaybackStatus(state: RadioClientState, currentTrack: Track | null): string {
  if (!currentTrack) return 'waiting for a track'
  if (state.status.toLowerCase().startsWith('loading')) return 'loading audio'
  if (!state.connected) return 'offline'
  if (!state.synced) return 'syncing'
  return state.playing ? 'playing' : 'paused'
}
