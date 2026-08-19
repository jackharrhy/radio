import { on, ref, type Handle } from "remix/ui";

import type { Track } from "../data/protocol.ts";
import {
  fitFontSize,
  fitText,
  getMaxTitleFontSize,
  getTextSurfaces,
  normalizeText,
} from "./pretext-fit.ts";
import { AudioVisualizer, AudioVisualizerPreview } from "./audio-visualizer.tsx";
import type { RadioClient, RadioClientState } from "./radio-client.ts";
import { radioStyle } from "./radio-room-styles.ts";

export function RadioGateView(
  handle: Handle<{
    nameInput: string;
    onNameInput?: (value: string) => void;
    onJoin?: () => void;
  }>,
) {
  return () => (
    <section mix={[radioStyle.window, radioStyle.gate]}>
      <form
        aria-label="Join radio"
        mix={[
          radioStyle.gateForm,
          on("submit", (event) => {
            event.preventDefault();
            handle.props.onJoin?.();
          }),
        ]}
      >
        <input
          aria-label="Name"
          name="name"
          type="text"
          autocomplete="name"
          placeholder="name"
          value={handle.props.nameInput}
          mix={[
            radioStyle.input,
            on("input", (event) => handle.props.onNameInput?.(event.currentTarget.value)),
          ]}
        />
        <button aria-label="Join radio" mix={radioStyle.smallPrimaryButton} type="submit">
          join radio
        </button>
      </form>
    </section>
  );
}

export function RadioPlayerView(
  handle: Handle<{
    state: RadioClientState;
    client: RadioClient | null;
    preview?: boolean;
    viewportWidth: number;
    onTrackInput?: (node: HTMLInputElement, signal: AbortSignal) => void;
    onUploadSelected?: (input: HTMLInputElement) => void;
    onAddTrack?: () => void;
  }>,
) {
  let scrubPosition: number | null = null;
  let pendingSeek: number | null = null;
  let pointerScrubbing = false;
  let scrubTrackId = handle.props.state.currentTrackId;

  function stageSeek(position: number): void {
    scrubPosition = position;
    pendingSeek = position;
    handle.update();
  }

  function commitSeek(): void {
    if (pendingSeek === null) return;
    let position = pendingSeek;
    pendingSeek = null;
    scrubPosition = null;
    handle.props.client?.seek(position);
    handle.update();
  }

  function getPointerPosition(event: PointerEvent & { currentTarget: HTMLInputElement }): number {
    let bounds = event.currentTarget.getBoundingClientRect();
    let ratio = bounds.width > 0 ? (event.clientX - bounds.left) / bounds.width : 0;
    let duration = handle.props.state.durationSeconds;
    let position = Math.max(0, Math.min(1, ratio)) * duration;
    return Math.round(position * 10) / 10;
  }

  return () => {
    let { state, client, preview = false, viewportWidth } = handle.props;
    if (scrubTrackId !== state.currentTrackId) {
      scrubTrackId = state.currentTrackId;
      scrubPosition = null;
      pendingSeek = null;
    }

    let currentTrack = state.tracks.find((track) => track.id === state.currentTrackId) ?? null;
    let surface = getTextSurfaces(viewportWidth);
    let currentTrackTitle = normalizeText(currentTrack?.title ?? "");
    let displayedPosition = scrubPosition ?? state.positionSeconds;

    return (
      <section
        data-radio-shell=""
        mix={[
          radioStyle.window,
          radioStyle.shell,
          preview ? radioStyle.previewShell : radioStyle.pageShell,
        ]}
      >
        <header mix={[radioStyle.titleBar, radioStyle.topBar]}>
          <StatusPill state={state} />
        </header>

        <section
          mix={[radioStyle.panel, radioStyle.nowPlaying]}
          aria-busy={isLoading(state)}
          data-empty={currentTrack === null ? "true" : "false"}
          aria-label={currentTrack?.title ?? "Nothing playing"}
        >
          {!preview && client ? (
            <AudioVisualizer
              client={client}
              playing={state.playing}
              positionSeconds={state.positionSeconds}
            />
          ) : (
            <AudioVisualizerPreview hasTrack={currentTrack !== null} playing={state.playing} />
          )}
          <div mix={radioStyle.trackMeta}>
            {currentTrack ? (
              <FittedTitle
                text={currentTrackTitle}
                title={currentTrack.title}
                fallbackWidth={surface.nowPlaying}
              />
            ) : null}
          </div>
        </section>

        <div mix={radioStyle.content}>
          <section mix={[radioStyle.panel, radioStyle.queuePanel]}>
            <div mix={radioStyle.sectionHeader}>
              <h2>playlist</h2>
              <input
                mix={[
                  radioStyle.fileInput,
                  ref((node, signal) => handle.props.onTrackInput?.(node, signal)),
                  on("change", (event) => handle.props.onUploadSelected?.(event.currentTarget)),
                ]}
                hidden={true}
                name="track"
                type="file"
                accept="audio/*,video/webm"
              />
              <button
                aria-label="Add track"
                mix={[
                  radioStyle.smallPrimaryButton,
                  on("click", (event) => {
                    event.preventDefault();
                    handle.props.onAddTrack?.();
                  }),
                ]}
                type="button"
              >
                upload track
              </button>
            </div>
            <div mix={radioStyle.queueScroll}>
              <TrackList state={state} client={client} surface={surface.queueTrack} />
            </div>
          </section>

          <aside mix={[radioStyle.panel, radioStyle.listeners]}>
            <h2 mix={radioStyle.utilityTitle}>listeners</h2>
            <ul mix={radioStyle.list}>
              {state.clients.map((person) => (
                <li key={person.clientId} mix={radioStyle.person}>
                  <span>{person.name}</span>
                  <small>{person.rtt ? `${Math.round(person.rtt)}ms` : "sync"}</small>
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
                on("click", () => (state.playing ? client?.pause() : client?.play())),
              ]}
              type="button"
              disabled={!state.tracks.some((track) => !track.upload)}
              aria-label={state.playing ? "Pause" : "Play"}
              title={state.playing ? "Pause" : "Play"}
            >
              {state.playing ? "Pause" : "Play"}
            </button>
            <button
              mix={[radioStyle.iconButton, on("click", () => void client?.wakeAudio())]}
              type="button"
              aria-label="Wake audio"
              title="Wake audio"
            >
              Wake
            </button>
            <button
              mix={[radioStyle.iconButton, on("click", () => client?.syncNow())]}
              type="button"
              disabled={!state.connected}
              aria-label="Sync playback"
              title="Sync playback"
            >
              Sync
            </button>
            <div mix={radioStyle.transportReadout}>
              <span>{state.playing ? "playing" : "paused"}</span>
            </div>
          </div>
          <label mix={radioStyle.seek}>
            <span>{formatTime(displayedPosition)}</span>
            <input
              aria-label="Track position"
              key={`${state.currentTrackId ?? "empty"}:${state.durationSeconds > 0 ? "ready" : "loading"}`}
              type="range"
              min="0"
              max={String(Math.max(0, state.durationSeconds))}
              step="0.1"
              value={String(
                Math.min(displayedPosition, state.durationSeconds || displayedPosition),
              )}
              disabled={!state.currentTrackId || state.durationSeconds <= 0}
              mix={[
                on("input", (event) => stageSeek(event.currentTarget.valueAsNumber)),
                on("change", commitSeek),
                on("pointerdown", (event) => {
                  if (event.currentTarget.disabled) return;
                  event.preventDefault();
                  pointerScrubbing = true;
                  event.currentTarget.focus();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  stageSeek(getPointerPosition(event));
                }),
                on("pointermove", (event) => {
                  if (!pointerScrubbing) return;
                  event.preventDefault();
                  stageSeek(getPointerPosition(event));
                }),
                on("pointerup", (event) => {
                  if (!pointerScrubbing) return;
                  event.preventDefault();
                  stageSeek(getPointerPosition(event));
                  pointerScrubbing = false;
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                  commitSeek();
                }),
                on("pointercancel", () => {
                  pointerScrubbing = false;
                  scrubPosition = null;
                  pendingSeek = null;
                  handle.update();
                }),
                on("keyup", commitSeek),
                on("blur", commitSeek),
              ]}
            />
            <span>{state.durationSeconds > 0 ? formatTime(state.durationSeconds) : "--:--"}</span>
          </label>
          <label mix={radioStyle.volume}>
            <span>vol</span>
            <input
              aria-label="Volume"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={String(state.volume)}
              mix={on("input", (event) => client?.setVolume(event.currentTarget.valueAsNumber))}
            />
            <span>{Math.round(state.volume * 100)}</span>
          </label>
        </footer>
      </section>
    );
  };
}

export function FittedTitle(
  handle: Handle<{ text: string; title?: string; fallbackWidth: number }>,
) {
  let width = handle.props.fallbackWidth;

  return () => {
    let surfaceWidth = width || handle.props.fallbackWidth;
    let fontSize = fitFontSize(
      handle.props.text,
      surfaceWidth,
      getMaxTitleFontSize(surfaceWidth),
      6,
    );

    return (
      <h1
        mix={[
          radioStyle.trackTitle,
          ref((node, signal) => {
            let updateWidth = (nextWidth: number) => {
              let roundedWidth = Math.max(0, Math.floor(nextWidth));
              if (Math.abs(width - roundedWidth) < 2) return;
              width = roundedWidth;
              handle.update();
            };

            updateWidth(node.getBoundingClientRect().width);

            let observer = new ResizeObserver((entries) => {
              updateWidth(entries[0]?.contentRect.width ?? 0);
            });
            observer.observe(node);
            signal.addEventListener("abort", () => observer.disconnect());
          }),
        ]}
        title={handle.props.title}
        style={{ fontSize: `${fontSize}px`, lineHeight: `${fontSize}px` }}
      >
        {handle.props.text}
      </h1>
    );
  };
}

export function TrackList(
  handle: Handle<{
    state: RadioClientState;
    client: RadioClient | null;
    surface: number;
  }>,
) {
  let editingTrackId: string | null = null;
  let draftTitle = "";
  let draggingTrackId: string | null = null;
  let dragOrder: string[] | null = null;
  let dropTargetId: string | null = null;

  function beginRename(track: Track): void {
    if (track.upload) return;
    editingTrackId = track.id;
    draftTitle = track.title;
    handle.update();
  }

  function cancelRename(): void {
    editingTrackId = null;
    draftTitle = "";
    handle.update();
  }

  function commitRename(track: Track): void {
    if (editingTrackId !== track.id) return;
    let nextTitle = draftTitle.trim();
    editingTrackId = null;
    draftTitle = "";
    if (nextTitle && nextTitle !== track.title) {
      handle.props.client?.renameTrack(track.id, nextTitle);
    }
    handle.update();
  }

  function getOrderedTracks(tracks: Track[]): Track[] {
    if (!dragOrder) return tracks;
    let byId = new Map(tracks.map((track) => [track.id, track]));
    let ordered = dragOrder.flatMap((trackId) => {
      let track = byId.get(trackId);
      return track ? [track] : [];
    });
    let orderedIds = new Set(ordered.map((track) => track.id));
    return [...ordered, ...tracks.filter((track) => !orderedIds.has(track.id))];
  }

  function stageDropTarget(track: Track, event: DragEvent & { currentTarget: HTMLElement }): void {
    if (!draggingTrackId || draggingTrackId === track.id) return;
    event.preventDefault();

    let tracks = getOrderedTracks(handle.props.state.tracks);
    let nextOrder = tracks.map((candidate) => candidate.id);
    let sourceIndex = nextOrder.indexOf(draggingTrackId);
    if (sourceIndex === -1) return;
    nextOrder.splice(sourceIndex, 1);

    let targetIndex = nextOrder.indexOf(track.id);
    if (targetIndex === -1) return;
    let bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientY >= bounds.top + bounds.height / 2) targetIndex++;
    nextOrder.splice(targetIndex, 0, draggingTrackId);

    let orderChanged =
      !dragOrder || nextOrder.some((trackId, index) => dragOrder?.[index] !== trackId);
    if (!orderChanged && dropTargetId === track.id) return;
    dragOrder = nextOrder;
    dropTargetId = track.id;
    handle.update();
  }

  function finishDrag(commit: boolean): void {
    let nextOrder = dragOrder;
    draggingTrackId = null;
    dragOrder = null;
    dropTargetId = null;
    if (commit && nextOrder) handle.props.client?.reorderTracks(nextOrder);
    handle.update();
  }

  function moveTrack(trackId: string, destination: "up" | "down" | "first" | "last"): void {
    let nextOrder = handle.props.state.tracks.map((track) => track.id);
    let sourceIndex = nextOrder.indexOf(trackId);
    if (sourceIndex === -1) return;
    let targetIndex =
      destination === "first"
        ? 0
        : destination === "last"
          ? nextOrder.length - 1
          : sourceIndex + (destination === "up" ? -1 : 1);
    targetIndex = Math.max(0, Math.min(nextOrder.length - 1, targetIndex));
    if (targetIndex === sourceIndex) return;
    nextOrder.splice(sourceIndex, 1);
    nextOrder.splice(targetIndex, 0, trackId);
    handle.props.client?.reorderTracks(nextOrder);
  }

  return () => {
    let { state } = handle.props;
    if (state.tracks.length === 0) {
      return null;
    }

    let orderedTracks = getOrderedTracks(state.tracks);

    return (
      <ol mix={radioStyle.queueList}>
        {orderedTracks.map((track, index) => {
          let active = track.id === state.currentTrackId;
          let uploadPercent = track.upload
            ? Math.round((track.upload.bytesReceived / track.upload.sizeBytes) * 100)
            : null;
          let distribution =
            state.bufferingTrackId === track.id && state.totalClientCount > 0
              ? `${state.readyClientCount}/${state.totalClientCount} ready`
              : null;
          let status = track.upload
            ? track.upload.status === "failed"
              ? "failed"
              : `↑ ${uploadPercent}%`
            : distribution;
          return (
            <li
              key={track.id}
              mix={[
                radioStyle.queueItem,
                active ? radioStyle.activeQueueItem : null,
                on("dragover", (event) => stageDropTarget(track, event)),
                on("drop", (event) => {
                  stageDropTarget(track, event);
                  finishDrag(true);
                }),
              ]}
              data-dragging={draggingTrackId === track.id ? "true" : undefined}
              data-drop-target={dropTargetId === track.id ? "true" : undefined}
              data-upload-status={track.upload?.status}
            >
              {track.upload?.status === "uploading" ? (
                <span
                  aria-hidden="true"
                  mix={radioStyle.trackProgress}
                  style={{ width: `${uploadPercent}%` }}
                />
              ) : null}
              <button
                aria-label={`Reorder ${track.title}`}
                aria-keyshortcuts="ArrowUp ArrowDown Home End"
                draggable={true}
                mix={[
                  radioStyle.dragHandle,
                  on("dragstart", (event) => {
                    draggingTrackId = track.id;
                    dragOrder = state.tracks.map((candidate) => candidate.id);
                    dropTargetId = track.id;
                    if (event.dataTransfer) {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", track.id);
                    }
                    handle.update();
                  }),
                  on("dragend", () => finishDrag(false)),
                  on("keydown", (event) => {
                    let destination: "up" | "down" | "first" | "last" | null =
                      event.key === "ArrowUp"
                        ? "up"
                        : event.key === "ArrowDown"
                          ? "down"
                          : event.key === "Home"
                            ? "first"
                            : event.key === "End"
                              ? "last"
                              : null;
                    if (!destination) return;
                    event.preventDefault();
                    moveTrack(track.id, destination);
                  }),
                ]}
                title={`Drag to reorder ${track.title}`}
                type="button"
              >
                Reorder
              </button>
              <button
                type="button"
                mix={[
                  radioStyle.trackButton,
                  on("click", () => handle.props.client?.play(track.id)),
                ]}
                disabled={Boolean(track.upload)}
              >
                <span mix={radioStyle.queueIndex}>{String(index + 1).padStart(2, "0")}</span>
                <span mix={radioStyle.queueTrack} title={track.title}>
                  <span>{fitText(track.title, handle.props.surface, 1)}</span>
                  {status ? <small>{status}</small> : null}
                </span>
              </button>
              {editingTrackId === track.id ? (
                <input
                  aria-label={`Rename ${track.title}`}
                  mix={[
                    radioStyle.input,
                    radioStyle.queueEditInput,
                    on("input", (event) => {
                      draftTitle = event.currentTarget.value;
                    }),
                    on("keydown", (event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitRename(track);
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        cancelRename();
                      }
                    }),
                    on("blur", () => commitRename(track)),
                  ]}
                  value={draftTitle}
                  autofocus={true}
                />
              ) : null}
              <span mix={radioStyle.trackActions}>
                {editingTrackId === track.id ? null : (
                  <button
                    type="button"
                    mix={[radioStyle.trackEditButton, on("click", () => beginRename(track))]}
                    disabled={Boolean(track.upload)}
                    aria-label={`Rename ${track.title}`}
                    title={`Rename ${track.title}`}
                  >
                    Rename
                  </button>
                )}
                <button
                  type="button"
                  mix={[
                    radioStyle.trackRemoveButton,
                    on("click", () => handle.props.client?.removeTrack(track.id)),
                  ]}
                  aria-label={`Remove ${track.title}`}
                  title={`Remove ${track.title}`}
                >
                  Remove
                </button>
              </span>
            </li>
          );
        })}
      </ol>
    );
  };
}

export function StatusPill(handle: Handle<{ state: RadioClientState }>) {
  return () => {
    let state = handle.props.state;
    let connection = state.connected ? "online" : "offline";
    let synchronization = state.synced ? "synced" : "syncing";
    let latency = `${Math.round(state.rttMs)}ms`;
    let details = state.connected
      ? `${connection} / ${synchronization} / ${latency}`
      : `${connection} / ${synchronization}`;
    let tone = !state.connected ? "offline" : state.synced ? "online" : "syncing";

    return (
      <output aria-label={details} data-tone={tone} mix={radioStyle.statusPill}>
        <span aria-hidden="true">
          <span>{connection}</span>
          <i>/</i>
          <span>{synchronization}</span>
          {state.connected ? (
            <>
              <i>/</i>
              <span>{latency}</span>
            </>
          ) : null}
        </span>
      </output>
    );
  };
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  let totalSeconds = Math.floor(seconds);
  let minutes = Math.floor(totalSeconds / 60);
  let remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function isLoading(state: RadioClientState): boolean {
  return state.status.toLowerCase().startsWith("buffering");
}
