import * as s from "remix/data-schema";
import { createController } from "remix/router";

import { beginUploadedTrack, writeUploadedTrack } from "../../data/audio-store.ts";
import { routes } from "../../routes.ts";

const uploadMetadataSchema = s.object({
  name: s.string(),
  mediaType: s.string(),
  sizeBytes: s.number(),
});

export default createController(routes.tracks, {
  actions: {
    async create({ request }) {
      let value: unknown;
      try {
        value = await request.json();
      } catch {
        return json({ error: "Invalid upload metadata" }, 400);
      }

      let parsed = s.parseSafe(uploadMetadataSchema, value);
      if (!parsed.success) return json({ error: "Invalid upload metadata" }, 400);

      try {
        let track = await beginUploadedTrack(parsed.value);
        return json({ track }, 201);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Upload failed" }, 400);
      }
    },
    async content({ params, request }) {
      try {
        let track = await writeUploadedTrack(params.trackId, request);
        return json({ track });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Upload failed" }, 400);
      }
    },
  },
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
