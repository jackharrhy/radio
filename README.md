# Radio

A small shared-room radio built with Remix 3. Everyone in the room sees the same queue and receives scheduled playback commands using an NTP-inspired clock estimate.

Radio is currently a local prototype. It deliberately has no public deployment until uploads and destructive room controls have an authentication and authorization boundary.

## What Works

- Server-rendered room entry and initial state
- Same-origin WebSocket presence and room coordination
- Shared play, pause, seek, and volume controls
- Audio uploads backed by the local filesystem
- Scheduled Web Audio playback with clock-offset sampling
- A responsive local desktop-style UI kit with no runtime stylesheet dependency

## Commands

```sh
npm install
npm run dev
npm test
npm run typecheck
npm run start
```

The server listens on `PORT` when set and defaults to `44100`.

## Project Shape

- `app/routes.ts` defines the URL contract.
- `app/actions/controller.tsx` owns the top-level HTTP actions.
- `app/router.ts` composes middleware and maps the route contract.
- `app/assets/` contains the hydrated room, browser audio client, and radio-specific presentation.
- `app/data/` contains the room protocol, coordination model, WebSocket adapter, and persistence.
- `app/ui/desktop/` contains the small reusable desktop theme and control/surface mixins.
- `app/ui/` contains the shared document and server-rendered radio page.

Uploaded audio is stored in `public/uploads/`, while queue and playback state are stored in `tmp/radio-state.json`. Both paths are ignored by Git. A deployment using this storage model must run as one application instance with a persistent volume.

## Upstream Inspiration

The synchronization approach was derived from [freeman-jiang/beatsync](https://github.com/freeman-jiang/beatsync), an MIT-licensed high-precision multi-device audio player. Jack's historical fork is [jackharrhy/beatsync](https://github.com/jackharrhy/beatsync).

For local source comparison, clone the upstream repository into `.upstream/beatsync`. That directory is intentionally ignored and is not a runtime dependency.

## Before Publishing

The remaining public-internet boundary is intentional: add authentication and per-action authorization, then add upload rate limits/quotas and choose durable object storage. Container and GHCR work should follow those decisions rather than freezing the current unauthenticated filesystem model into production.
