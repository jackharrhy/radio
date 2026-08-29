import * as assert from "remix/assert";
import { it } from "remix/test";
import { jsx } from "remix/ui/jsx-runtime";
import { render } from "remix/ui/test";

import type { Track } from "../data/protocol.ts";
import {
  DEFAULT_SYNC_DIAGNOSTICS,
  type RadioClient,
  type RadioClientState,
} from "./radio-client.ts";
import { RadioPlayerView, TrackList } from "./radio-room-components.tsx";

const track: Track = {
  id: "track-1",
  title: "Track 1",
  url: "/uploads/track-1.mp3",
  addedAt: 1,
};

const tracks: Track[] = [
  track,
  { id: "track-2", title: "Track 2", url: "/uploads/track-2.mp3", addedAt: 2 },
  { id: "track-3", title: "Track 3", url: "/uploads/track-3.mp3", addedAt: 3 },
];

it("keeps a drag position visible and commits a paused seek once", async () => {
  let positions: number[] = [];
  let renames: Array<[string, string]> = [];
  let state: RadioClientState = {
    connected: true,
    synced: true,
    offsetMs: 0,
    rttMs: 1,
    ...DEFAULT_SYNC_DIAGNOSTICS,
    tracks: [track],
    clients: [],
    currentTrackId: track.id,
    bufferingTrackId: null,
    readyClientCount: 0,
    totalClientCount: 0,
    bufferedSeconds: 0,
    playing: false,
    positionSeconds: 12,
    durationSeconds: 120,
    volume: 1,
    status: "Paused",
  };
  let client = {
    seek(position: number) {
      positions.push(position);
      state.positionSeconds = position;
    },
    renameTrack(trackId: string, title: string) {
      renames.push([trackId, title]);
    },
  } as RadioClient;
  let result = render(
    jsx(RadioPlayerView, {
      state,
      client,
      preview: true,
      viewportWidth: 960,
    }),
  );

  try {
    assert.equal(result.$('button[aria-label="Play"]')?.getAttribute("title"), "Play");
    assert.equal(result.$('button[aria-label="Wake audio"]')?.getAttribute("title"), "Wake audio");
    assert.equal(
      result.$('button[aria-label="Sync playback"]')?.getAttribute("title"),
      "Sync playback",
    );
    let neutralOffset = result.$('output[data-zero="true"]');
    assert.equal(neutralOffset?.textContent, "0ms");
    assert.equal(neutralOffset?.getAttribute("aria-hidden"), "true");
    assert.equal(neutralOffset?.getAttribute("aria-label"), null);
    assert.doesNotMatch(result.container.textContent ?? "", /paused|0ms calibration/);
    assert.equal(
      result.$('button[aria-label="Remove Track 1"]')?.getAttribute("title"),
      "Remove Track 1",
    );

    await result.act(() =>
      result.$('button[aria-label="Rename Track 1"]')?.dispatchEvent(new MouseEvent("click")),
    );
    let renameInput = result.$('input[aria-label="Rename Track 1"]') as HTMLInputElement;
    renameInput.value = "Renamed track";
    await result.act(() => {
      renameInput.dispatchEvent(new Event("input", { bubbles: true }));
      renameInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    assert.deepEqual(renames, [["track-1", "Renamed track"]]);

    let seek = result.$('input[aria-label="Track position"]') as HTMLInputElement;
    seek.getBoundingClientRect = () => ({ left: 0, width: 200 }) as unknown as DOMRect;
    seek.setPointerCapture = () => {};
    seek.hasPointerCapture = () => true;
    seek.releasePointerCapture = () => {};

    await result.act(() => {
      seek.dispatchEvent(createPointerEvent("pointerdown", 50));
      seek.dispatchEvent(createPointerEvent("pointermove", 100));
      seek.dispatchEvent(createPointerEvent("pointerup", 150));
    });

    seek = result.$('input[aria-label="Track position"]') as HTMLInputElement;
    assert.equal(seek.value, "90");
    assert.equal(seek.parentElement?.querySelector("span")?.textContent, "1:30");
    await result.act(() => seek.dispatchEvent(new Event("change", { bubbles: true })));

    assert.deepEqual(positions, [90]);
  } finally {
    result.cleanup();
  }
});

it("shows a local playback offset only when it is non-zero", () => {
  let state: RadioClientState = {
    connected: true,
    synced: true,
    offsetMs: 0,
    rttMs: 1,
    ...DEFAULT_SYNC_DIAGNOSTICS,
    deviceCompensationMs: 20,
    tracks: [],
    clients: [],
    currentTrackId: null,
    bufferingTrackId: null,
    readyClientCount: 0,
    totalClientCount: 0,
    bufferedSeconds: 0,
    playing: false,
    positionSeconds: 0,
    durationSeconds: 0,
    volume: 1,
    status: "Paused",
  };
  let result = render(
    jsx(RadioPlayerView, {
      state,
      client: null,
      preview: true,
      viewportWidth: 960,
    }),
  );

  try {
    let offset = result.$('output[aria-label^="Playback offset"]');
    assert.equal(offset?.textContent, "−20ms");
    assert.equal(offset?.getAttribute("aria-label"), "Playback offset: 20 milliseconds earlier");
    assert.doesNotMatch(result.container.textContent ?? "", /paused|calibration/);
  } finally {
    result.cleanup();
  }
});

it("reorders tracks with drag and drop and with the keyboard", async () => {
  let orders: string[][] = [];
  let state: RadioClientState = {
    connected: true,
    synced: true,
    offsetMs: 0,
    rttMs: 1,
    ...DEFAULT_SYNC_DIAGNOSTICS,
    tracks,
    clients: [],
    currentTrackId: null,
    bufferingTrackId: null,
    readyClientCount: 0,
    totalClientCount: 0,
    bufferedSeconds: 0,
    playing: false,
    positionSeconds: 0,
    durationSeconds: 0,
    volume: 1,
    status: "Ready",
  };
  let client = {
    reorderTracks(trackIds: string[]) {
      orders.push(trackIds);
    },
  } as RadioClient;
  let result = render(jsx(TrackList, { state, client, surface: 720 }));

  try {
    let firstHandle = result.$('button[aria-label="Reorder Track 1"]')!;
    await result.act(() => firstHandle.dispatchEvent(createDragEvent("dragstart", 0)));

    let thirdItem = result.$('button[aria-label="Reorder Track 3"]')!.closest("li")!;
    thirdItem.getBoundingClientRect = () =>
      ({ top: 0, height: 40, bottom: 40 }) as unknown as DOMRect;
    await result.act(() => thirdItem.dispatchEvent(createDragEvent("dragover", 30)));

    thirdItem = result.$('button[aria-label="Reorder Track 3"]')!.closest("li")!;
    thirdItem.getBoundingClientRect = () =>
      ({ top: 0, height: 40, bottom: 40 }) as unknown as DOMRect;
    await result.act(() => thirdItem.dispatchEvent(createDragEvent("drop", 30)));

    assert.deepEqual(orders, [["track-2", "track-3", "track-1"]]);

    await result.act(() =>
      result
        .$('button[aria-label="Reorder Track 2"]')!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })),
    );
    assert.deepEqual(orders.at(-1), ["track-1", "track-3", "track-2"]);
  } finally {
    result.cleanup();
  }
});

it("keeps actionable queue progress and groups compact track actions", () => {
  let uploadingTrack: Track = {
    id: "track-upload",
    title: "Uploading track",
    url: "/uploads/track-upload.mp3",
    addedAt: 4,
    upload: { status: "uploading", bytesReceived: 31, sizeBytes: 100 },
  };
  let state: RadioClientState = {
    connected: true,
    synced: false,
    offsetMs: 0,
    rttMs: 1,
    ...DEFAULT_SYNC_DIAGNOSTICS,
    tracks: [track, uploadingTrack],
    clients: [],
    currentTrackId: track.id,
    bufferingTrackId: track.id,
    readyClientCount: 1,
    totalClientCount: 4,
    bufferedSeconds: 22,
    playing: false,
    positionSeconds: 0,
    durationSeconds: 100,
    volume: 1,
    status: "Buffering clients",
  };
  let result = render(jsx(TrackList, { state, client: null, surface: 720 }));

  try {
    let queueText = result.$("ol")?.textContent ?? "";
    assert.match(queueText, /1\/4 ready/);
    assert.match(queueText, /↑ 31%/);
    assert.doesNotMatch(queueText, /buf|22%/);

    let rename = result.$('button[aria-label="Rename Track 1"]');
    let remove = result.$('button[aria-label="Remove Track 1"]');
    assert.equal(rename?.parentElement, remove?.parentElement);
  } finally {
    result.cleanup();
  }
});

function createPointerEvent(type: string, clientX: number): Event {
  let event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: clientX },
    pointerId: { value: 1 },
  });
  return event;
}

function createDragEvent(type: string, clientY: number): Event {
  let event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientY: { value: clientY },
    dataTransfer: {
      value: {
        effectAllowed: "none",
        setData() {},
      },
    },
  });
  return event;
}
