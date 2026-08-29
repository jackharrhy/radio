# Radio

A multi-room synchronized audio player. Remix renders the application inside a Worker, and each
named room is a Celld/Cloudflare-compatible Durable Object with private SQLite state and
hibernatable WebSockets. Audio content lives in the `TRACKS` R2-compatible object binding.

## Local development

Install Node.js 26+, dependencies, and Celld 0.4.0 or newer:

```sh
npm install
curl -fsSL https://celld.dev/install.sh | sh
npm run dev
```

Wrangler provides the normal local development server. Use `npm run dev:celld` for a compatibility
run on the real Celld runtime, which serves <http://127.0.0.1:9876> and stores its local state under
`.celld/dev/`. Celld 0.4.0 currently detects a spurious source change after startup in this repo;
the application works, but its development watcher may repeatedly rebuild. The root redirects to
the default `cozy` room; any valid slug can be opened at `/rooms/:roomSlug`.

Client assets are prebuilt into ignored `dist/client/` files because a Worker has no source
filesystem from which `remix/assets` can compile modules on demand.

Useful commands:

```sh
npm run build
npm run dev
npm run dev:celld
npm run types:worker
npm run check
npx remix doctor
```

## Production model

`wrangler.jsonc` is accepted by both Celld and Wrangler. A Celld fleet runs one deployed
application and stores its deployment, cell databases, ownership records, and replication state
in its configured fleet bucket. The `TRACKS` binding is a separate logical R2 bucket within that
deployment.

Build and publish the application to a configured fleet bucket:

```sh
npm run deploy:celld -- --bucket "$CELLD_BUCKET"
```

Then start one or more Celld nodes against that bucket. Public TLS and authentication remain the
responsibility of Traefik. Only Celld's public Worker listener may be exposed; its internal peer
and operator listener must remain on a trusted private network.

The application still has no accounts or room-level authorization. Treat every room and mutation
as private behind the existing host-wide BasicAuth boundary.

## Room and storage ownership

- `worker.ts` owns public request dispatch, Remix SSR, uploads, and ranged media responses.
- `app/data/radio-room-cell.ts` owns one room's SQLite state, WebSockets, queue, and playback.
- `app/data/radio-room-store.ts` owns the room's SQLite schema and persistence operations.
- `app/routes.ts` and `app/actions/` own the server-rendered page contract.
- `app/assets/` owns hydrated playback, clock synchronization, and browser audio.
- `test/` owns Worker, Durable Object, R2, alarm, and WebSocket integration tests.
- `dist/client/` is generated and must not be committed.

## Inspiration

The synchronization approach, and overall vibes, are derived from [freeman-jiang/beatsync](https://github.com/freeman-jiang/beatsync).
