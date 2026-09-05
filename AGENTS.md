# Radio Agent Guide

Radio is a multi-room synchronized audio player built with Remix 3 and Celld. Keep the
server-rendered route correct first, then layer the hydrated WebSocket and Web Audio behavior on
top. Each room is one named Durable Object/cell.

## Commands

```sh
npm install
npm run dev
npm run build
npm run format
npm run lint
npm run check
npm run dev:celld
npm test
npm run typecheck
```

## Remix Version Alignment

- Follow `./.agents/skills/remix/SKILL.md` when changing routes, middleware, assets, UI, or tests.
- The tracked skill is copied from the installed Remix CLI template and must stay aligned with the pinned `remix` version.
- Before upgrading Remix, compare `.agents/skills/remix/` with `node_modules/@remix-run/cli/template/.agents/skills/remix/` and refresh the tracked copy together with any API migrations.

## Beatsync Reference

The synchronization design was derived from the MIT-licensed [freeman-jiang/beatsync](https://github.com/freeman-jiang/beatsync) project.

Keep an inspection-only clone at `./.upstream/beatsync`. That directory is ignored by Git and must not become a runtime dependency or an accidental nested repository in commits. Preserve applicable upstream attribution when adapting code.

## Route And Runtime Ownership

- `app/routes.ts` is the URL contract.
- `worker.ts` owns Worker startup and public request dispatch.
- `app/data/worker-radio-runtime.ts` owns room-cell dispatch, upload storage, and ranged media
  responses.
- `app/actions/controller.tsx` owns top-level Remix HTTP responses.
- `app/router.ts` composes Remix middleware and maps the route contract.
- `app/middleware/render.tsx` owns request-scoped server rendering.
- `app/assets/` owns hydrated browser behavior and radio-specific client presentation.
- Keep clock estimation, audio-timeline conversion, and playback drift correction as separate pure
  models with synthetic skew, jitter, output-latency, and recovery tests.
- `app/data/radio-room-cell.ts` owns per-room SQLite state, WebSockets, and coordination.
- `app/data/radio-room-store.ts` owns the per-room SQLite schema and persistence operations.
- `app/data/room-directory-cell.ts` owns the persistent public room directory.
- `app/data/` owns the shared protocol, room identity, and timing policy.
- `app/middleware/access.ts` owns the shared-password session and access boundaries.
- `app/ui/` owns shared server UI and cross-route visual primitives.

Put code in the narrowest owner. Add `app/actions/<route-key>/controller.tsx` only when a nested route map needs its own actions or middleware. Do not create generic `app/lib/` or `app/components/` buckets.

## Local UI Kit

`app/ui/desktop/` is a deliberately small local UI kit, not a general design system.

- Keep theme tokens and reusable control/surface mixins there.
- Keep radio layout and radio-only selectors with the hydrated radio feature.
- Prefer native semantic elements plus Remix `mix` behavior over wrapper components that only pass props through.

## State And Deployment Boundaries

- `.celld/dev/` contains ignored local cell and object state.
- `dist/client/` contains ignored, generated browser assets.
- Each room has isolated SQLite state and hibernatable WebSockets in one named cell.
- Uploaded audio lives in the `TRACKS` R2-compatible binding, not a filesystem.
- The public lobby lists rooms. A signed 30-day application session protects room pages,
  WebSockets, uploads, and room mutations. Listener names come from that trusted session rather
  than WebSocket messages.
- Authentication currently uses one shared application password. There are no individual users,
  room owners, or room-level permissions; every password holder can create and mutate every room.
- The approved production boundary is a Celld fleet behind Traefik TLS with rate limiting on the
  native `/join` action. Expose only Celld's public Worker listener; keep its internal
  peer/operator listener private.
- A regular Celld fleet requires a bucket backend with atomic conditional create and overwrite,
  read-after-write consistency, exact ranged reads, listing, and deletion. Azurite is acceptable
  for this single-host, non-critical deployment but is not qualified by Celld for production.
- Keep the object-store data and Celld work directory on persistent host volumes. Treat the
  bucket as the fleet's authority and back it up together with Celld's local state.
- Production uses two long-running services: one Azurite blob-storage container and one Radio
  image that idempotently deploys the current Worker before starting Celld. Do not reintroduce
  separate bucket-bootstrap or deployment-image services.
- Pushes to `main` publish the single-platform `linux/amd64` image as `ghcr.io/jackharrhy/radio:main`.

## Verification

- Use Remix route/server tests for rendering and real Worker tests for HTTP and coordination behavior.
- Use component tests only for DOM-specific behavior.
- Add regression coverage for lifecycle, reconnect, synchronization, and persistence bugs.
- Finish changes with `npm test`, `npm run typecheck`, `remix doctor`, and a production-mode smoke test.
