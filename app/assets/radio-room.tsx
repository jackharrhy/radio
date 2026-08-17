import { addEventListeners, clientEntry, on, ref, type Handle, type SerializableProps } from 'remix/ui'

import type { RoomSnapshot } from '../data/protocol.ts'
import { fitText, getTextSurfaces, normalizeText } from './pretext-fit.ts'
import { RadioClient, type RadioClientState } from './radio-client.ts'
import {
  FittedTitle,
  formatTime,
  getPlaybackStatus,
  StatusPill,
  TrackList,
} from './radio-room-components.tsx'
import { radioStyle } from './radio-room-styles.ts'

interface RadioRoomProps extends SerializableProps {
  initialSnapshot: RoomSnapshot
}

export const RadioRoom = clientEntry(
  import.meta.url,
  function RadioRoom(handle: Handle<RadioRoomProps>) {
    let initialSnapshot = handle.props.initialSnapshot
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
      addEventListeners(window, signal, { resize: updateViewportWidth })
      name = localStorage.getItem('radio.name')?.trim() ?? ''
      nameInput = name
      if (name) start(name)
      else handle.update()
      signal.addEventListener('abort', () => {
        client?.dispose()
      })
    })

    return () => {
      if (!name) {
        return (
          <section mix={[radioStyle.window, radioStyle.gate]}>
            <div mix={radioStyle.titleBar}>cozy radio / identify</div>
            <div mix={radioStyle.messageCard}>
              <header mix={radioStyle.messageHeader}>radio room</header>
              <h1 mix={radioStyle.gateTitle}>ENTER THE ROOM</h1>
              <p mix={radioStyle.status}>Choose a name before joining the shared queue.</p>
            </div>
            <form
              mix={[
                radioStyle.gateForm,
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
                  radioStyle.input,
                  on('input', (event) => {
                    nameInput = event.currentTarget.value
                    handle.update()
                  }),
                ]}
              />
              <button mix={radioStyle.primaryButton} type="submit">Join</button>
            </form>
          </section>
        )
      }

      let currentTrack = state.tracks.find((track) => track.id === state.currentTrackId) ?? null
      let surface = getTextSurfaces(viewportWidth)
      let currentTrackTitle = normalizeText(currentTrack?.title ?? 'No track loaded')
      let statusText = fitText(getPlaybackStatus(state, currentTrack !== null), surface.status, 1)

      return (
        <section mix={[radioStyle.window, radioStyle.shell]}>
          <header mix={[radioStyle.titleBar, radioStyle.topBar]}>
            <div mix={radioStyle.brand}>
              <span>radio</span>
              <strong>{state.playing ? 'on air' : 'standby'}</strong>
            </div>
            <StatusPill state={state} />
          </header>

          <section mix={[radioStyle.panel, radioStyle.nowPlaying]}>
            <div mix={radioStyle.trackMeta}>
              <header mix={radioStyle.messageHeader}>now</header>
              <FittedTitle text={currentTrackTitle} title={currentTrack?.title ?? undefined} fallbackWidth={surface.nowPlaying} />
              <p mix={radioStyle.status} title={state.status}>{statusText}</p>
            </div>
          </section>

          <div mix={radioStyle.content}>
            <section mix={[radioStyle.panel, radioStyle.queuePanel]}>
              <div mix={radioStyle.sectionHeader}>
                <h2>playlist</h2>
                <span>{state.tracks.length} tracks</span>
              </div>
              <div mix={radioStyle.upload}>
                <input
                  mix={[
                    radioStyle.fileInput,
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
                    radioStyle.primaryButton,
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
              <div mix={radioStyle.queueScroll}>
                <TrackList tracks={state.tracks} currentTrackId={state.currentTrackId} client={client} surface={surface.queueTrack} />
              </div>
            </section>

            <aside mix={[radioStyle.panel, radioStyle.listeners]}>
              <h2 mix={radioStyle.utilityTitle}>listeners</h2>
              <ul mix={radioStyle.list}>
                {state.clients.map((person) => (
                  <li key={person.clientId} mix={radioStyle.person}>
                    <span>{person.name}</span>
                    <small>{person.rtt ? `${Math.round(person.rtt)}ms` : 'sync'}</small>
                  </li>
                ))}
              </ul>
            </aside>
          </div>

          <footer mix={radioStyle.controlBar}>
            <div mix={radioStyle.transport}>
              <button
                mix={[
                  radioStyle.playToggle,
                  on('click', () => (state.playing ? client?.pause() : client?.play())),
                ]}
                type="button"
                disabled={!state.tracks.length}
                aria-label={state.playing ? 'Pause' : 'Play'}
              >
                {state.playing ? 'Pause' : 'Play'}
              </button>
              <button
                mix={[radioStyle.iconButton, on('click', () => void client?.wakeAudio())]}
                type="button"
                aria-label="Wake audio"
              >
                Wake
              </button>
              <button
                mix={[radioStyle.iconButton, on('click', () => client?.syncNow())]}
                type="button"
                disabled={!state.connected}
                aria-label="Sync playback"
              >
                Sync
              </button>
              <div mix={radioStyle.transportReadout}>
                <span>{state.playing ? 'playing' : 'paused'}</span>
                <strong title={state.status}>
                  {fitText(
                    state.synced ? 'synced with room' : 'syncing with room',
                    surface.transportStatus,
                    1,
                  )}
                </strong>
              </div>
            </div>
            <label mix={radioStyle.seek}>
              <span>{formatTime(state.positionSeconds)}</span>
              <input
                type="range"
                min="0"
                max={String(Math.max(0, state.durationSeconds))}
                step="0.1"
                value={String(
                  Math.min(state.positionSeconds, state.durationSeconds || state.positionSeconds),
                )}
                disabled={!state.currentTrackId || state.durationSeconds <= 0}
                mix={on('change', (event) => client?.seek(event.currentTarget.valueAsNumber))}
              />
              <span>
                {state.durationSeconds > 0 ? formatTime(state.durationSeconds) : '--:--'}
              </span>
            </label>
            <label mix={radioStyle.volume}>
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

function getOrCreateClientId(): string {
  let existing = localStorage.getItem('radio.clientId')
  if (existing) return existing
  let next = crypto.randomUUID()
  localStorage.setItem('radio.clientId', next)
  return next
}
