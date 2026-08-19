import * as assert from "remix/assert";
import { it } from "remix/test";
import { jsx } from "remix/ui/jsx-runtime";
import { render } from "remix/ui/test";

import type { Track } from "../data/protocol.ts";
import type { RadioClient, RadioClientState } from "./radio-client.ts";
import { RadioPlayerView } from "./radio-room-components.tsx";

const track: Track = {
  id: "track-1",
  title: "Track 1",
  url: "/uploads/track-1.mp3",
  addedAt: 1,
};

it("keeps a drag position visible and commits a paused seek once", async () => {
  let positions: number[] = [];
  let renames: Array<[string, string]> = [];
  let state: RadioClientState = {
    connected: true,
    synced: true,
    offsetMs: 0,
    rttMs: 1,
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

function createPointerEvent(type: string, clientX: number): Event {
  let event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: clientX },
    pointerId: { value: 1 },
  });
  return event;
}
