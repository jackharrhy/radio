import { on, ref, type Handle } from 'remix/ui'

import type { Track } from '../data/protocol.ts'
import { fitFontSize, fitText, getMaxTitleFontSize } from './pretext-fit.ts'
import type { RadioClient, RadioClientState } from './radio-client.ts'
import { radioStyle } from './radio-room-styles.ts'

export function FittedTitle(
  handle: Handle<{ text: string; title?: string; fallbackWidth: number }>,
) {
  let width = handle.props.fallbackWidth

  return () => {
    let surfaceWidth = width || handle.props.fallbackWidth
    let fontSize = fitFontSize(
      handle.props.text,
      surfaceWidth,
      getMaxTitleFontSize(surfaceWidth),
      6,
    )

    return (
      <h1
        mix={[
          radioStyle.trackTitle,
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

export function TrackList(
  handle: Handle<{
    tracks: Track[]
    currentTrackId: string | null
    client: RadioClient | null
    surface: number
  }>,
) {
  return () => {
    if (handle.props.tracks.length === 0) {
      return (
        <p mix={radioStyle.empty}>
          Upload the first track. Everyone in the room shares this queue.
        </p>
      )
    }

    return (
      <ol mix={radioStyle.queueList}>
        {handle.props.tracks.map((track, index) => {
          let active = track.id === handle.props.currentTrackId
          return (
            <li
              key={track.id}
              mix={[radioStyle.queueItem, active ? radioStyle.activeQueueItem : null]}
            >
              <button
                type="button"
                mix={[
                  radioStyle.trackButton,
                  on('click', () => handle.props.client?.play(track.id)),
                ]}
              >
                <span mix={radioStyle.queueIndex}>{String(index + 1).padStart(2, '0')}</span>
                <span mix={radioStyle.queueTrack} title={track.title}>
                  {fitText(track.title, handle.props.surface, 1)}
                </span>
              </button>
              <button
                type="button"
                mix={[
                  radioStyle.dangerButton,
                  on('click', () => handle.props.client?.removeTrack(track.id)),
                ]}
                aria-label={`Remove ${track.title}`}
              >
                Remove
              </button>
            </li>
          )
        })}
      </ol>
    )
  }
}

export function StatusPill(handle: Handle<{ state: RadioClientState }>) {
  return () => (
    <div mix={radioStyle.statusPill}>
      <span>{handle.props.state.connected ? 'online' : 'offline'}</span>
      <span>{handle.props.state.synced ? 'synced' : 'syncing'}</span>
      <span>{Math.round(handle.props.state.rttMs)}ms</span>
    </div>
  )
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  let totalSeconds = Math.floor(seconds)
  let minutes = Math.floor(totalSeconds / 60)
  let remainingSeconds = totalSeconds % 60
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

export function getPlaybackStatus(state: RadioClientState, hasCurrentTrack: boolean): string {
  if (!hasCurrentTrack) return 'waiting for a track'
  if (state.status.toLowerCase().startsWith('loading')) return 'loading audio'
  if (!state.connected) return 'offline'
  if (!state.synced) return 'syncing'
  return state.playing ? 'playing' : 'paused'
}
