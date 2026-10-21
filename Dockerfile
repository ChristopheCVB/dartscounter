ARG BUN_VERSION=1.4.3

FROM oven/bun:${BUN_VERSION} AS base
WORKDIR /app

FROM base AS build
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
RUN bun run build

FROM base AS production
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
COPY --from=build /app/.output /app/.output
EXPOSE 3000/tcp
ENTRYPOINT ["bun", ".output/server/index.mjs"]
