import * as assert from "remix/assert";
import { it } from "remix/test";

import { createAppRouter } from "../../router.ts";
import { routes } from "../../routes.ts";

it("renders the development kitchen sink with representative radio states", async () => {
  let router = createAppRouter(
    {
      listRooms: () => Promise.resolve([]),
      getRoom: () => Promise.resolve(null),
      createRoom: () => Promise.resolve("created"),
      fetchRoom: () => Promise.resolve(new Response("Room service unavailable", { status: 503 })),
      uploadTrack: () => Promise.resolve(new Response("Room service unavailable", { status: 503 })),
      serveTrack: () => Promise.resolve(new Response("Room service unavailable", { status: 503 })),
    },
    {
      password: "test-password",
      sessionSecret: "test-session-secret-that-is-at-least-32-characters",
      secureCookies: false,
    },
  );
  let response = await router.fetch(
    new Request(`http://localhost${routes.dev.kitchenSink.href()}`),
  );
  let html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /<title>Radio \/ UI<\/title>/);
  assert.match(html, /signed out \/ validation/);
  assert.match(html, /available rooms/);
  assert.match(html, /start a room/);
  assert.match(html, /TrackListPreview/);
  assert.match(html, /paused \/ 20ms earlier/);
  assert.match(html, /loading \/ syncing/);
  assert.match(html, /playing \/ dense/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
});
