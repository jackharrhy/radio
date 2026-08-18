import * as assert from "remix/assert";
import { it } from "remix/test";

import { closeRadioServer } from "./radio-ws.ts";

it("terminates upgraded WebSocket clients before awaiting server shutdown", async () => {
  let calls: string[] = [];
  let onHttpClose: ((error?: Error) => void) | undefined;
  let onWebSocketClose: ((error?: Error) => void) | undefined;

  let server = {
    close(callback: (error?: Error) => void) {
      calls.push("http.close");
      onHttpClose = callback;
    },
    closeAllConnections() {
      calls.push("http.closeAllConnections");
      onHttpClose?.();
    },
  };
  let wss = {
    clients: new Set([
      {
        terminate() {
          calls.push("websocket.terminate");
          onWebSocketClose?.();
        },
      },
    ]),
    close(callback: (error?: Error) => void) {
      calls.push("websocket.close");
      onWebSocketClose = callback;
    },
  };

  await closeRadioServer(server, wss);

  assert.deepEqual(calls, [
    "http.close",
    "websocket.close",
    "websocket.terminate",
    "http.closeAllConnections",
  ]);
});
