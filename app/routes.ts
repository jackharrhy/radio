import { get, post, route } from "remix/routes";

export const routes = route({
  assets: get("/assets/*path"),
  home: "/",
  tracks: post("/tracks"),
});
