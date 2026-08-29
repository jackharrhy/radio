import { createContextKey, type Middleware } from "remix/router";

export interface RoomCellsService {
  fetch(roomSlug: string, pathname: string, init?: RequestInit): Promise<Response>;
}

export const RoomCells = createContextKey<RoomCellsService>();

export function roomCells(service: RoomCellsService): Middleware {
  return (context, next) => {
    context.set(RoomCells, service);
    return next();
  };
}
