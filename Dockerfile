FROM node:26-bookworm-slim@sha256:cd565714d4da3e84bfd341e31448f81d47c6362198f152345297c9c1154e6341 AS celld

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
  && export CELLD_VERSION=v0.4.0 && curl -fsSL https://celld.dev/install.sh | sh \
  && rm -rf /var/lib/apt/lists/*

FROM node:26-bookworm-slim@sha256:cd565714d4da3e84bfd341e31448f81d47c6362198f152345297c9c1154e6341 AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY scripts/sync-icon-font.mjs scripts/sync-icon-font.mjs
RUN npm ci

COPY . .
RUN npm run build

FROM node:26-bookworm-slim@sha256:cd565714d4da3e84bfd341e31448f81d47c6362198f152345297c9c1154e6341 AS deployer

WORKDIR /app

ENV CELLD_BIN=/usr/local/bin/celld

COPY --from=celld /root/.local/bin/celld /usr/local/bin/celld
COPY --from=build /app /app

CMD ["celld", "deploy", "."]

FROM node:26-bookworm-slim@sha256:cd565714d4da3e84bfd341e31448f81d47c6362198f152345297c9c1154e6341 AS runtime

ENV CELLD_ADDR=0.0.0.0:44100
ENV CELLD_INTERNAL_ADDR=127.0.0.1:44101
ENV CELLD_WATCH=/app/.celld

WORKDIR /app

COPY --from=celld /root/.local/bin/celld /usr/local/bin/celld

RUN mkdir -p /app/.celld && chown -R node:node /app

USER node

EXPOSE 44100
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:44100/').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"]

CMD ["celld"]
