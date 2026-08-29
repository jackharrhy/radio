import { createRouter, type MiddlewareContext } from "remix/router";
import controller from "./actions/controller.tsx";
import devController from "./actions/dev/controller.tsx";
import roomsController from "./actions/rooms/controller.tsx";
import { roomCells, type RoomCellsService } from "./data/room-cells.ts";
import { render } from "./middleware/render.tsx";
import { routes } from "./routes.ts";

type AppContext = MiddlewareContext<[ReturnType<typeof render>, ReturnType<typeof roomCells>]>;

declare module "remix/router" {
  interface RouterTypes {
    context: AppContext;
  }
}

export function createAppRouter(service: RoomCellsService) {
  let router = createRouter<AppContext>({ middleware: [render(), roomCells(service)] });

  router.map(routes, controller);
  router.map(routes.dev, devController);
  router.map(routes.rooms, roomsController);
  return router;
}
