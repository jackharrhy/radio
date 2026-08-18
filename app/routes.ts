import { get, post, route } from "remix/routes";

export const routes = route({
  assets: get("/assets/*path"),
  dev: route("dev", {
    kitchenSink: get("kitchen-sink"),
  }),
  home: "/",
  tracks: post("/tracks"),
});
