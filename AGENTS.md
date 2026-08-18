# Radio Agent Guide

Radio is a single-room synchronized audio player built with Remix 3. Keep the server-rendered route correct first, then layer the hydrated WebSocket and Web Audio behavior on top.

## Commands

```sh
npm install
npm run dev
npm run format
npm run lint
npm run check
npm run start
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
- `app/actions/controller.tsx` owns top-level HTTP responses.
- `app/router.ts` composes middleware and maps the route contract.
- `app/middleware/render.tsx` owns request-scoped server rendering.
- `app/assets/` owns hydrated browser behavior and radio-specific client presentation.
- `app/data/` owns the protocol, room state, persistence, upload storage, and WebSocket adapter.
- `app/ui/` owns shared server UI and cross-route visual primitives.

Put code in the narrowest owner. Add `app/actions/<route-key>/controller.tsx` only when a nested route map needs its own actions or middleware. Do not create generic `app/lib/` or `app/components/` buckets.

## Local UI Kit

`app/ui/desktop/` is a deliberately small local UI kit, not a general design system.

- Keep theme tokens and reusable control/surface mixins there.
- Keep radio layout and radio-only selectors with the hydrated radio feature.
- Prefer native semantic elements plus Remix `mix` behavior over wrapper components that only pass props through.

## State And Deployment Boundaries

- `public/uploads/` contains ignored local audio files.
- `tmp/radio-state.json` contains ignored local queue and playback state.
- The room and connected clients are process-local. The current model requires one process and persistent local storage.
- The app is not ready for an unrestricted public URL: uploads and room mutations have no application-level authentication or authorization.
- The approved production boundary is one container behind host-wide Traefik BasicAuth, including `/ws`, with persistent mounts at `/app/public/uploads` and `/app/tmp`.
- Pushes to `main` publish the single-platform `linux/amd64` image as `ghcr.io/jackharrhy/radio:main`.

## Verification

- Use route/server tests for HTTP and coordination behavior.
- Use component tests only for DOM-specific behavior.
- Add regression coverage for lifecycle, reconnect, synchronization, and persistence bugs.
- Finish changes with `npm test`, `npm run typecheck`, `remix doctor`, and a production-mode smoke test.
