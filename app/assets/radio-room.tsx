import { addEventListeners, clientEntry, type Handle, type SerializableProps } from "remix/ui";

import type { RoomSnapshot } from "../data/protocol.ts";
import { RadioClient, type RadioClientState } from "./radio-client.ts";
import { RadioGateView, RadioPlayerView } from "./radio-room-components.tsx";

interface RadioRoomProps extends SerializableProps {
  roomSlug?: string;
  initialSnapshot: RoomSnapshot;
}

export const RadioRoom = clientEntry(
  "radio-room",
  function RadioRoom(handle: Handle<RadioRoomProps>) {
    let initialSnapshot = handle.props.initialSnapshot;
    let client: RadioClient | null = null;
    let name = "";
    let nameInput = "";
    let trackInput: HTMLInputElement | null = null;
    let viewportWidth = 960;
    let state: RadioClientState = {
      connected: false,
      synced: false,
      offsetMs: 0,
      rttMs: 0,
      tracks: initialSnapshot.tracks,
      clients: initialSnapshot.clients,
      currentTrackId: initialSnapshot.playback.trackId,
      bufferingTrackId: null,
      readyClientCount: 0,
      totalClientCount: 0,
      bufferedSeconds: 0,
      playing: initialSnapshot.playback.type === "playing",
      positionSeconds: initialSnapshot.playback.trackTimeSeconds,
      durationSeconds: 0,
      volume: initialSnapshot.volume,
      status: "Ready",
    };

    function start(nextName: string) {
      if (client) return;
      name = nextName.trim();
      if (!name) return;
      localStorage.setItem("radio.name", name);
      let clientId = getOrCreateClientId();
      client = new RadioClient({
        roomSlug: handle.props.roomSlug ?? initialSnapshot.roomId,
        initialSnapshot,
        clientId,
        name,
      });
      client.onState((nextState) => {
        state = nextState;
        handle.update();
      });
      client.connect();
      handle.update();
    }

    async function uploadSelectedTrack(input: HTMLInputElement) {
      if (!input.files?.[0]) return;
      await client?.upload(input.files[0]);
      input.value = "";
    }

    handle.signal.addEventListener("abort", () => {
      client?.dispose();
    });

    handle.queueTask(() => {
      let updateViewportWidth = () => {
        viewportWidth = document.documentElement.clientWidth || window.innerWidth;
        handle.update();
      };
      updateViewportWidth();
      addEventListeners(window, handle.signal, { resize: updateViewportWidth });
      name = localStorage.getItem("radio.name")?.trim() ?? "";
      nameInput = name;
      if (name) start(name);
      else handle.update();
    });

    return () => {
      if (!name) {
        return (
          <RadioGateView
            nameInput={nameInput}
            onNameInput={(value) => {
              nameInput = value;
              handle.update();
            }}
            onJoin={() => start(nameInput)}
          />
        );
      }

      return (
        <RadioPlayerView
          state={state}
          client={client}
          viewportWidth={viewportWidth}
          onTrackInput={(node, signal) => {
            trackInput = node;
            signal.addEventListener("abort", () => {
              if (trackInput === node) trackInput = null;
            });
          }}
          onUploadSelected={(input) => void uploadSelectedTrack(input)}
          onAddTrack={() => trackInput?.click()}
        />
      );
    };
  },
);

function getOrCreateClientId(): string {
  let existing = localStorage.getItem("radio.clientId");
  if (existing) return existing;
  let next = crypto.randomUUID();
  localStorage.setItem("radio.clientId", next);
  return next;
}
