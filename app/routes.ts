import { get, post, put, route } from "remix/routes";

export const routes = route({
  assets: get("/assets/*path"),
  dev: route("dev", {
    kitchenSink: get("kitchen-sink"),
  }),
  home: "/",
  tracks: route("tracks", {
    create: post("/"),
    content: put(":trackId/content"),
  }),
});
