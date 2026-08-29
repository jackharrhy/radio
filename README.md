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

Pushes to `main` publish `ghcr.io/jackharrhy/radio:main`, which is a pinned Celld runtime image;
the image no longer contains the Radio application. Publishing the image and deploying the
application are deliberately separate operations. Before rolling the image into production:

1. Provision an S3-compatible fleet bucket and credentials, then deploy Radio to it with
   `npm run deploy:celld -- --bucket "$CELLD_BUCKET"`.
2. Configure every node with the same `CELLD_BUCKET`, `S3_ENDPOINT`, `AWS_REGION`, and AWS
   credentials. Persist `/app/.celld`, Celld's local SQLite and replication working directory.
3. For a multi-node fleet, override the image's loopback-only `CELLD_INTERNAL_ADDR`, set a unique
   peer-reachable `CELLD_ADVERTISE` value on each node, and keep that listener private. The
   loopback default intentionally supports only one node.
4. Point Traefik at port `44100`, preserve the host-wide BasicAuth policy, and replace both
   forwarded host/protocol headers before enabling `CELLD_TRUST_FORWARDED_HEADERS=1`.
5. Confirm the root health check and a WebSocket room join before removing the old container.

The former `/app/public/uploads` and `/app/tmp` volumes are not read by Celld. Existing audio must
be imported into the `TRACKS` object bucket and queues recreated (or migrated with a purpose-built
one-off tool) before those volumes are retired. Running nodes poll the fleet deployment pointer,
so later `celld deploy` releases are adopted without rebuilding or restarting the node image.

For a self-hosted, single-node installation, the `deployer` Docker target supports the same Azurite
bootstrap used by the infrastructure repository: it creates the configured blob container, runs
Celld's conditional-write diagnostic, and deploys Radio. CI publishes this target as
`ghcr.io/jackharrhy/radio-celld-deployer`. Azurite is an emulator, not a Celld-qualified production
store; keep it private, pin its version, persist and back up both its data and `CELLD_WATCH`, and use
this topology only where that single-host durability tradeoff is acceptable.

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

## Playback synchronization

Clients exchange paired four-timestamp probes with their room cell. The browser keeps a bounded
low-delay sample history, rejects network-delay outliers, and fits a robust offset-and-clock-skew
model. Shared server timestamps are converted to the Web Audio timeline with
`AudioContext.getOutputTimestamp()` when available, with an output-latency fallback otherwise.

The media element streams the track through separate volume and audible-gate gain stages. During
playback, a bounded ±800 ppm rate servo corrects small clock drift; errors of 750 ms or more are
re-anchored by seeking. The `−10ms` and `+10ms` controls persist a per-browser output-device
calibration for latency that the browser cannot measure, such as downstream Bluetooth buffering.

## Inspiration

The synchronization approach, and overall vibes, are derived from [freeman-jiang/beatsync](https://github.com/freeman-jiang/beatsync).
