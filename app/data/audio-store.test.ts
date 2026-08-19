import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import * as assert from "remix/assert";
import { it } from "remix/test";

import { AudioStore } from "./audio-store.ts";
import { RadioSpace } from "./radio-space.ts";
import { trackFilePath, trackPartPath } from "./track-files.ts";

it("streams an upload into its reserved file and exposes progress in the queue", async () => {
  let uploadDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "radio-upload-"));
  let space = new RadioSpace({ persist: false, uploadDirectory });
  let store = new AudioStore({ space, uploadDirectory });
  let bytes = new TextEncoder().encode("progressive audio bytes");

  try {
    let pending = await store.begin({
      name: "Naked Flames.html",
      mediaType: "audio/mpeg",
      sizeBytes: bytes.byteLength,
    });
    assert.equal(pending.upload?.status, "uploading");
    assert.equal(pending.url.endsWith("-Naked-Flames.mp3"), true);
    assert.equal(
      await fs.access(trackPartPath(pending, uploadDirectory)).then(
        () => true,
        () => false,
      ),
      true,
    );

    let completed = await store.write(
      pending.id,
      new Request("http://localhost/tracks/content", {
        method: "PUT",
        headers: { "content-length": String(bytes.byteLength) },
        body: bytes,
      }),
    );

    assert.equal(completed.upload, undefined);
    assert.deepEqual(
      new Uint8Array(await fs.readFile(trackFilePath(completed, uploadDirectory))),
      bytes,
    );
    assert.equal(
      await fs.access(trackPartPath(completed, uploadDirectory)).then(
        () => true,
        () => false,
      ),
      false,
    );
  } finally {
    await fs.rm(uploadDirectory, { recursive: true, force: true });
  }
});

it("marks an interrupted upload as failed and removes its partial file", async () => {
  let uploadDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "radio-upload-failed-"));
  let space = new RadioSpace({ persist: false, uploadDirectory });
  let store = new AudioStore({ space, uploadDirectory });

  try {
    let pending = await store.begin({
      name: "Incomplete.mp3",
      mediaType: "audio/mpeg",
      sizeBytes: 20,
    });

    await assert.rejects(
      store.write(
        pending.id,
        new Request("http://localhost/tracks/content", {
          method: "PUT",
          body: new TextEncoder().encode("short"),
        }),
      ),
      /Upload size did not match/,
    );

    assert.equal(space.getTrack(pending.id)?.upload?.status, "failed");
    assert.equal(
      await fs.access(trackPartPath(pending, uploadDirectory)).then(
        () => true,
        () => false,
      ),
      false,
    );
  } finally {
    await fs.rm(uploadDirectory, { recursive: true, force: true });
  }
});
