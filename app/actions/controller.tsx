import { createController } from "remix/router";

import { assetServer } from "../assets.ts";
import { radioSpace } from "../data/radio-space.ts";
import { routes } from "../routes.ts";
import { RadioPage } from "../ui/radio-page.tsx";

export default createController(routes, {
  actions: {
    async assets(context) {
      return (
        (await assetServer.fetch(context.request)) ?? new Response("Not Found", { status: 404 })
      );
    },
    async home(context) {
      await radioSpace.load();
      return context.render(<RadioPage snapshot={radioSpace.snapshot()} />);
    },
  },
});
