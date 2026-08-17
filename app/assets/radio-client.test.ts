import * as assert from "remix/assert";
import { afterEach, beforeEach, describe, it } from "remix/test";

import { ROOM_ID, type RoomSnapshot } from "../data/protocol.ts";
import { RadioClient } from "./radio-client.ts";

type Listener = (event?: unknown) => void;

class FakeWebSocket {
  static OPEN = 1;
  readyState = FakeWebSocket.OPEN;
  sent: unknown[] = [];
  private listeners = new Map<string, Listener[]>();

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data) as unknown);
  }

  close(): void {
    this.readyState = 3;
  }

  emit(type: string, event?: unknown): void {
    for (let listener of this.listeners.get(type) ?? []) listener(event);
  }
}

class FakeSource {
  buffer: AudioBuffer | null = null;
  startedAt = 0;
  offset = 0;
  stoppedAt = 0;
  private endedListeners = new Set<() => void>();

  connect(): void {}
  disconnect(): void {}

  addEventListener(type: string, listener: () => void): void {
    if (type === "ended") this.endedListeners.add(listener);
  }

  start(when = 0, offset = 0): void {
    this.startedAt = when;
    this.offset = offset;
  }

  stop(when = 0): void {
    this.stoppedAt = when;
    for (let listener of this.endedListeners) listener();
    this.endedListeners.clear();
  }
}

class FakeAudioManager {
  currentTime = 0;
  sources: FakeSource[] = [];

  async resume(): Promise<void> {}
  setMasterGain(): void {}
  getInputNode(): AudioNode {
    return {} as AudioNode;
  }
  getContext(): AudioContext {
    return { currentTime: this.currentTime } as AudioContext;
  }
  createBufferSource(): AudioBufferSourceNode {
    let source = new FakeSource();
    this.sources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }
  async decodeAudioData(): Promise<AudioBuffer> {
    return { duration: 120 } as AudioBuffer;
  }
}

let originalWebSocket: typeof globalThis.WebSocket | undefined;
let originalWindow: typeof globalThis.window | undefined;
let originalFetch: typeof globalThis.fetch | undefined;
let sockets: FakeWebSocket[] = [];
let windowTimers = new Map<number, () => void>();
let nextWindowTimerId = 1;

beforeEach(() => {
  sockets = [];
  windowTimers = new Map();
  nextWindowTimerId = 1;
  originalWebSocket = globalThis.WebSocket;
  originalWindow = globalThis.window;
  originalFetch = globalThis.fetch;

  globalThis.WebSocket = class extends FakeWebSocket {
    constructor(url: string) {
      super(url);
      sockets.push(this);
    }
  } as unknown as typeof WebSocket;

  globalThis.window = {
    setTimeout(callback: () => void) {
      let id = nextWindowTimerId++;
      windowTimers.set(id, callback);
      return id;
    },
    clearTimeout(id: number) {
      windowTimers.delete(id);
    },
    setInterval: globalThis.setInterval.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis),
    location: { protocol: "http:", host: "localhost:44100" },
  } as unknown as typeof window;

  globalThis.fetch = async () => new Response(new ArrayBuffer(0));
});

afterEach(() => {
  if (originalWebSocket) globalThis.WebSocket = originalWebSocket;
  if (originalWindow) globalThis.window = originalWindow;
  if (originalFetch) globalThis.fetch = originalFetch;
});

function snapshot(): RoomSnapshot {
  return {
    roomId: ROOM_ID,
    tracks: [
      { id: "track-1", title: "Track 1", url: "/uploads/track-1.mp3", addedAt: 1 },
      { id: "track-2", title: "Track 2", url: "/uploads/track-2.mp3", addedAt: 2 },
    ],
    clients: [],
    playback: { type: "paused", trackId: null, trackTimeSeconds: 0, serverTimeToExecute: 0 },
    volume: 1,
  };
}

function message(type: string, value: unknown): { data: string } {
  return { data: JSON.stringify({ type, ...(value as Record<string, unknown>) }) };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("RadioClient playback UI behavior", () => {
  it("starts a different selected track from 0 instead of reusing current track position", async () => {
    let audio = new FakeAudioManager();
    let client = new RadioClient({
      initialSnapshot: snapshot(),
      clientId: "client-1",
      name: "Ada",
      audioManager: audio,
    });
    client.connect();
    let socket = sockets[0];
    socket.emit("open");
    socket.sent = [];

    socket.emit(
      "message",
      message("SCHEDULED_PLAY", {
        trackId: "track-1",
        trackTimeSeconds: 42,
        serverTimeToExecute: performance.timeOrigin + performance.now(),
      }),
    );
    await flush();
    socket.sent = [];

    client.play("track-2");

    assert.partialDeepEqual(socket.sent.at(-1), {
      type: "PLAY",
      trackId: "track-2",
      trackTimeSeconds: 0,
    });
    client.dispose();
  });

  it("does not mark a paused track as ended when Web Audio fires ended after stop", async () => {
    let audio = new FakeAudioManager();
    let client = new RadioClient({
      initialSnapshot: snapshot(),
      clientId: "client-1",
      name: "Ada",
      audioManager: audio,
    });
    client.connect();
    let socket = sockets[0];
    socket.emit("open");

    socket.emit(
      "message",
      message("SCHEDULED_PLAY", {
        trackId: "track-1",
        trackTimeSeconds: 30,
        serverTimeToExecute: performance.timeOrigin + performance.now(),
      }),
    );
    await flush();
    socket.emit(
      "message",
      message("SCHEDULED_PAUSE", {
        trackId: "track-1",
        trackTimeSeconds: 12,
        serverTimeToExecute: performance.timeOrigin + performance.now(),
      }),
    );

    assert.equal(client.state.playing, false);
    assert.equal(client.state.positionSeconds, 12);
    assert.equal(client.state.durationSeconds, 120);
    client.dispose();
  });

  it("sends an NTP request when sync is triggered from the UI", () => {
    let audio = new FakeAudioManager();
    let client = new RadioClient({
      initialSnapshot: snapshot(),
      clientId: "client-1",
      name: "Ada",
      audioManager: audio,
    });
    client.connect();
    let socket = sockets[0];
    socket.emit("open");
    socket.sent = [];

    client.syncNow();

    assert.equal((socket.sent[0] as { type: string }).type, "NTP_REQUEST");
    client.dispose();
  });

  it("does not reconnect after disposal", () => {
    let audio = new FakeAudioManager();
    let client = new RadioClient({
      initialSnapshot: snapshot(),
      clientId: "client-1",
      name: "Ada",
      audioManager: audio,
    });
    client.connect();
    let socket = sockets[0];
    socket.emit("open");

    assert.equal(windowTimers.size, 1);
    client.dispose();
    socket.emit("close");

    assert.equal(windowTimers.size, 0);
    assert.equal(sockets.length, 1);
  });

  it("does not report a failed track load as ready", async () => {
    globalThis.fetch = async () => new Response(null, { status: 500 });
    let audio = new FakeAudioManager();
    let client = new RadioClient({
      initialSnapshot: snapshot(),
      clientId: "client-1",
      name: "Ada",
      audioManager: audio,
    });
    client.connect();
    let socket = sockets[0];
    socket.emit("open");
    socket.sent = [];

    socket.emit("message", message("LOAD_TRACK", { track: snapshot().tracks[0] }));
    await flush();

    assert.equal(
      socket.sent.some((value) => (value as { type?: string }).type === "TRACK_READY"),
      false,
    );
    assert.equal(client.state.status, "Could not load Track 1");
    client.dispose();
  });

  it("surfaces an upload failure in client state", async () => {
    globalThis.fetch = async () =>
      Response.json({ error: "Uploads are unavailable" }, { status: 503 });
    let audio = new FakeAudioManager();
    let client = new RadioClient({
      initialSnapshot: snapshot(),
      clientId: "client-1",
      name: "Ada",
      audioManager: audio,
    });

    await client.upload(new File(["audio"], "track.mp3", { type: "audio/mpeg" }));

    assert.equal(client.state.status, "Uploads are unavailable");
    client.dispose();
  });
});
