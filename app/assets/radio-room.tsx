import { addEventListeners, clientEntry, type Handle, type SerializableProps } from "remix/ui";

import type { RoomSnapshot } from "../data/protocol.ts";
import { DEFAULT_SYNC_DIAGNOSTICS, RadioClient, type RadioClientState } from "./radio-client.ts";
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
      ...DEFAULT_SYNC_DIAGNOSTICS,
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
      let deviceCompensationMs = readDeviceCompensation();
      client = new RadioClient({
        roomSlug: handle.props.roomSlug ?? initialSnapshot.roomId,
        initialSnapshot,
        clientId,
        name,
        deviceCompensationMs,
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
  let next = createClientId();
  localStorage.setItem("radio.clientId", next);
  return next;
}

function readDeviceCompensation(): number {
  let value = Number(localStorage.getItem("radio.deviceCompensationMs"));
  return Number.isFinite(value) ? value : 0;
}

type ClientCrypto = {
  getRandomValues(array: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer>;
  randomUUID?: () => string;
};

export function createClientId(source: ClientCrypto = crypto): string {
  if (typeof source.randomUUID === "function") return source.randomUUID();
  let bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  let hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}
