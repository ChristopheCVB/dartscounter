FROM oven/bun:1.4.4 AS base
WORKDIR /app

FROM base AS build
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
RUN bun run build

FROM base AS production
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NITRO_BUN_IDLE_TIMEOUT=60
COPY --from=build /app/.output /app/.output
COPY --from=build /app/server/db/migrations /app/server/db/migrations
EXPOSE 3000/tcp
ENTRYPOINT ["bun", ".output/server/index.mjs"]
