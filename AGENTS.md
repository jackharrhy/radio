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
- `worker.ts` owns the Worker fetch boundary, room-cell dispatch, uploads, and media responses.
- `app/actions/controller.tsx` owns top-level Remix HTTP responses.
- `app/router.ts` composes Remix middleware and maps the route contract.
- `app/middleware/render.tsx` owns request-scoped server rendering.
- `app/assets/` owns hydrated browser behavior and radio-specific client presentation.
- Keep clock estimation, audio-timeline conversion, and playback drift correction as separate pure
  models with synthetic skew, jitter, output-latency, and recovery tests.
- `app/data/radio-room-cell.ts` owns per-room SQLite state, WebSockets, and coordination.
- `app/data/radio-room-store.ts` owns the per-room SQLite schema and persistence operations.
- `app/data/` owns the shared protocol, room identity, and timing policy.
- `app/ui/` owns shared server UI and cross-route visual primitives.

Put code in the narrowest owner. Add `app/actions/<route-key>/controller.tsx` only when a nested route map needs its own actions or middleware. Do not create generic `app/lib/` or `app/components/` buckets.

## Local UI Kit

`app/ui/desktop/` is a deliberately small local UI kit, not a general design system.

- Keep theme tokens and reusable control/surface mixins there.
- Keep radio layout and radio-only selectors with the hydrated radio feature.
- Prefer native semantic elements plus Remix `mix` behavior over wrapper components that only pass props through.

## Visual Reference

- Use [spiritov/ds.css](https://github.com/spiritov/ds.css) and the Nintendo DS PictoChat UI as
  reference points when designing net-new components.
- Treat them as inspiration, not a package dependency or a pixel-perfect specification. Radio is a
  cleaner, higher-resolution interpretation that should still feel compact, tactile, and familiar.
- Translate PictoChat cues through the existing local tokens and primitives: pale neutral surfaces,
  restrained cyan accents, fine horizontal texture, crisp borders, small stepped corners, and clear
  pressed and focus states. Preserve accessibility and consistency with existing Radio components.

## State And Deployment Boundaries

- `.celld/dev/` contains ignored local cell and object state.
- `dist/client/` contains ignored, generated browser assets.
- Each room has isolated SQLite state and hibernatable WebSockets in one named cell.
- Uploaded audio lives in the `TRACKS` R2-compatible binding, not a filesystem.
- The app is not ready for an unrestricted public URL: uploads and room mutations have no application-level authentication or authorization.
- The approved production boundary is a Celld fleet behind host-wide Traefik BasicAuth. Expose
  only its public Worker listener; keep its internal peer/operator listener private.
- Pushes to `main` publish the single-platform `linux/amd64` image as `ghcr.io/jackharrhy/radio:main`.

## Verification

- Use Remix route/server tests for rendering and real Worker tests for HTTP and coordination behavior.
- Use component tests only for DOM-specific behavior.
- Add regression coverage for lifecycle, reconnect, synchronization, and persistence bugs.
- Finish changes with `npm test`, `npm run typecheck`, `remix doctor`, and a production-mode smoke test.
