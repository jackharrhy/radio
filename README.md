# Radio

A small shared-room radio.

```sh
npm install
npm run dev
```

The server listens on `PORT` when set and defaults to `44100`.

## Container

The production image runs one Node process and stores its mutable state in two directories:

- `/app/public/uploads` for uploaded audio
- `/app/tmp` for queue and playback state

```sh
docker build -t radio .
docker run --rm -p 44100:44100 \
  -v radio-uploads:/app/public/uploads \
  -v radio-state:/app/tmp \
  radio
```

Pushes to `main` publish `ghcr.io/jackharrhy/radio:main`. The app has no internal user
accounts; its production deployment is private only because Traefik applies BasicAuth to the
entire host, including the WebSocket upgrade at `/ws`.

## Inspiration

The synchronization approach, and overall vibes, are derived from [freeman-jiang/beatsync](https://github.com/freeman-jiang/beatsync).
