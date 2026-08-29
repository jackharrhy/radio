import { createController } from "remix/router";

import { DEFAULT_ROOM_SLUG, roomPath } from "../data/room-id.ts";
import { routes } from "../routes.ts";
import { redirect } from "remix/response/redirect";

export default createController(routes, {
  actions: {
    home() {
      return redirect(roomPath(DEFAULT_ROOM_SLUG));
    },
  },
});
