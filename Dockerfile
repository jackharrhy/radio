FROM node:26-bookworm-slim@sha256:cd565714d4da3e84bfd341e31448f81d47c6362198f152345297c9c1154e6341 AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
COPY scripts ./scripts

RUN npm ci --omit=dev && npm cache clean --force

FROM node:26-bookworm-slim@sha256:cd565714d4da3e84bfd341e31448f81d47c6362198f152345297c9c1154e6341 AS runtime

ENV NODE_ENV=production
ENV PORT=44100

WORKDIR /app

COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json tsconfig.json server.ts ./
COPY --chown=node:node app ./app
COPY --chown=node:node public ./public
COPY --from=dependencies --chown=node:node /app/public/fonts/material-symbols-rounded.woff2 ./public/fonts/material-symbols-rounded.woff2

RUN mkdir -p public/uploads tmp && chown -R node:node public/uploads tmp

USER node

EXPOSE 44100
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:44100/').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"]

CMD ["npm", "start"]
