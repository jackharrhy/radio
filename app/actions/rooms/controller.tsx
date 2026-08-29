import { createController } from "remix/router";

import { RoomCells } from "../../data/room-cells.ts";
import { normalizeRoomSlug } from "../../data/room-id.ts";
import type { RoomSnapshot } from "../../data/protocol.ts";
import { routes } from "../../routes.ts";
import { RadioPage } from "../../ui/radio-page.tsx";

export default createController(routes.rooms, {
  actions: {
    async show(context) {
      let roomSlug = normalizeRoomSlug(context.params.roomSlug ?? "");
      if (!roomSlug) return new Response("Room not found", { status: 404 });
      let response = await context.get(RoomCells)!.fetch(roomSlug, "/snapshot");
      if (!response.ok) return new Response("Room unavailable", { status: 503 });
      let snapshot = (await response.json()) as RoomSnapshot;
      return context.render(<RadioPage roomSlug={roomSlug} snapshot={snapshot} />);
    },
  },
});
