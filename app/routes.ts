import { get, route } from "remix/routes";

export const routes = route({
  dev: route("dev", {
    kitchenSink: get("kitchen-sink"),
  }),
  home: "/",
  rooms: route("rooms", {
    show: get(":roomSlug"),
  }),
});
