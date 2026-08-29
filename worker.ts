import type { RoomCellsService } from "./app/data/room-cells.ts";
import { resolveMediaRange } from "./app/data/media-range.ts";
import { normalizeRoomSlug } from "./app/data/room-id.ts";
import { RadioRoomCell } from "./app/data/radio-room-cell.ts";
import { createAppRouter } from "./app/router.ts";

export { RadioRoomCell };

export default {
  async fetch(request, env): Promise<Response> {
    try {
      let url = new URL(request.url);

      let websocket = /^\/ws\/([^/]+)$/.exec(url.pathname);
      if (websocket) {
        let roomSlug = normalizeRoomSlug(decodeURIComponent(websocket[1]!));
        if (!roomSlug) return new Response("Room not found", { status: 404 });
        return roomStub(env, roomSlug).fetch(cellRequest(request, roomSlug, "/websocket"));
      }

      let tracks = /^\/api\/rooms\/([^/]+)\/tracks(?:\/([^/]+)\/content)?$/.exec(url.pathname);
      if (tracks) {
        let roomSlug = normalizeRoomSlug(decodeURIComponent(tracks[1]!));
        if (!roomSlug) return Response.json({ error: "Room not found" }, { status: 404 });
        if (!tracks[2] && request.method === "POST") {
          return roomStub(env, roomSlug).fetch(cellRequest(request, roomSlug, "/tracks"));
        }
        if (tracks[2] && request.method === "PUT") {
          return uploadTrack(request, env, roomSlug, decodeURIComponent(tracks[2]));
        }
        return new Response("Method Not Allowed", { status: 405 });
      }

      let media = /^\/media\/([^/]+)\/([^/]+)$/.exec(url.pathname);
      if (media && (request.method === "GET" || request.method === "HEAD")) {
        let roomSlug = normalizeRoomSlug(decodeURIComponent(media[1]!));
        if (!roomSlug) return new Response("Not Found", { status: 404 });
        return serveTrack(request, env, roomSlug, decodeURIComponent(media[2]!));
      }

      let router = createAppRouter(createRoomCellsService(env));
      let response = await router.fetch(request);
      if (response.status !== 404) return response;
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(JSON.stringify({ event: "request_failed", error: errorMessage(error) }));
      return new Response("Internal Server Error", { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;

function createRoomCellsService(env: Env): RoomCellsService {
  return {
    fetch(roomSlug, pathname, init) {
      return roomStub(env, roomSlug).fetch(
        cellRequest(new Request("https://cell.internal" + pathname, init), roomSlug, pathname),
      );
    },
  };
}

function roomStub(env: Env, roomSlug: string): DurableObjectStub {
  return env.RADIO_ROOMS.getByName(roomSlug);
}

function cellRequest(request: Request, roomSlug: string, pathname: string): Request {
  let headers = new Headers(request.headers);
  headers.set("x-radio-room", roomSlug);
  return new Request("https://cell.internal" + pathname, {
    method: request.method,
    headers,
    body: request.body,
    redirect: request.redirect,
  });
}

async function uploadTrack(
  request: Request,
  env: Env,
  roomSlug: string,
  trackId: string,
): Promise<Response> {
  let stub = roomStub(env, roomSlug);
  let uploadResponse = await stub.fetch(
    cellRequest(
      new Request("https://cell.internal"),
      roomSlug,
      `/tracks/${encodeURIComponent(trackId)}/upload`,
    ),
  );
  if (!uploadResponse.ok) return uploadResponse;
  let upload = (await uploadResponse.json()) as {
    track: { upload: { sizeBytes: number } };
    objectKey: string;
  };
  if (!request.body) return Response.json({ error: "Missing track file" }, { status: 400 });

  let declaredLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > upload.track.upload.sizeBytes) {
    return Response.json({ error: "File is too large" }, { status: 400 });
  }

  try {
    let object = await env.TRACKS.put(upload.objectKey, request.body, {
      httpMetadata: {
        contentType: request.headers.get("Content-Type") ?? "application/octet-stream",
      },
    });
    if (object.size !== upload.track.upload.sizeBytes) {
      await env.TRACKS.delete(upload.objectKey);
      throw new Error("Upload size did not match the selected file");
    }
    let completion = await stub.fetch(
      cellRequest(
        new Request("https://cell.internal", { method: "POST" }),
        roomSlug,
        `/tracks/${encodeURIComponent(trackId)}/complete`,
      ),
    );
    if (!completion.ok) await env.TRACKS.delete(upload.objectKey);
    return completion;
  } catch (error) {
    await stub.fetch(
      cellRequest(
        new Request("https://cell.internal", { method: "POST" }),
        roomSlug,
        `/tracks/${encodeURIComponent(trackId)}/failed`,
      ),
    );
    return Response.json({ error: errorMessage(error) }, { status: 400 });
  }
}

async function serveTrack(
  request: Request,
  env: Env,
  roomSlug: string,
  trackId: string,
): Promise<Response> {
  let object = await env.TRACKS.get(`rooms/${roomSlug}/tracks/${trackId}`, {
    range: request.headers,
  });
  if (!object) return new Response("Not Found", { status: 404 });
  let headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("ETag", object.httpEtag);
  if ("range" in object && object.range) {
    let { offset, length } = resolveMediaRange(object.range, object.size);
    headers.set("Content-Range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set("Content-Length", String(length));
  } else {
    headers.set("Content-Length", String(object.size));
  }
  return new Response(request.method === "HEAD" ? null : object.body, {
    status: "range" in object && object.range ? 206 : 200,
    headers,
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed";
}
