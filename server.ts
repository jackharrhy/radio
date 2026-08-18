import * as http from "node:http";
import { createRequestListener } from "remix/node-fetch-server";

import { attachRadioWebSocketServer, closeRadioServer } from "./app/data/radio-ws.ts";
import { radioSpace } from "./app/data/radio-space.ts";
import { router } from "./app/router.ts";

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100;

const server = http.createServer(
  createRequestListener(async (request) => {
    try {
      return await router.fetch(request);
    } catch (error) {
      if (!(request.signal.aborted && error === request.signal.reason)) {
        console.error(error);
      }
      return new Response("Internal Server Error", { status: 500 });
    }
  }),
);

await radioSpace.load();
const radioWss = attachRadioWebSocketServer(server);

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) {
    console.error(`Received ${signal} again; forcing shutdown.`);
    process.exit(130);
  }

  shuttingDown = true;
  console.log(`Received ${signal}; shutting down.`);

  let forceExitTimer = setTimeout(() => {
    console.error("Graceful shutdown timed out; forcing shutdown.");
    process.exit(1);
  }, 5000);
  forceExitTimer.unref();

  try {
    await closeRadioServer(server, radioWss);
    clearTimeout(forceExitTimer);
    process.exit(0);
  } catch (error) {
    clearTimeout(forceExitTimer);
    console.error("Failed to shut down cleanly", error);
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
