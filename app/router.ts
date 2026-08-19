import { createRouter, type MiddlewareContext } from "remix/router";
import { staticFiles } from "remix/middleware/static";

import controller from "./actions/controller.tsx";
import devController from "./actions/dev/controller.tsx";
import tracksController from "./actions/tracks/controller.ts";
import { render } from "./middleware/render.tsx";
import { routes } from "./routes.ts";

type AppContext = MiddlewareContext<[ReturnType<typeof render>]>;

declare module "remix/router" {
  interface RouterTypes {
    context: AppContext;
  }
}

export const router = createRouter<AppContext>({
  middleware: [staticFiles("./public", { index: false }), render()],
});

router.map(routes, controller);
router.map(routes.dev, devController);
router.map(routes.tracks, tracksController);
