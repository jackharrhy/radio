import * as assert from "remix/assert";
import { it } from "remix/test";

import { createAppRouter } from "../../router.ts";
import { routes } from "../../routes.ts";

it("renders the development kitchen sink with representative radio states", async () => {
  let router = createAppRouter({
    fetch: () => Promise.resolve(new Response("Room service unavailable", { status: 503 })),
  });
  let response = await router.fetch(
    new Request(`http://localhost${routes.dev.kitchenSink.href()}`),
  );
  let html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /<title>Radio \/ UI<\/title>/);
  assert.match(html, /loading \/ syncing/);
  assert.match(html, /playing \/ dense/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
});
