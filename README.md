# DartCounter

A local-first darts scoring app built with Nuxt. Bun is the runtime and package manager.

## Setup

Install [mise](https://mise.jdx.dev/getting-started.html), then install the Bun version pinned in `mise.toml` and the project dependencies:

```bash
mise trust
mise install bun
mise exec -- bun install --frozen-lockfile
```

With mise shell activation enabled, you can run `bun` directly. Otherwise, prefix commands with `mise exec --` as shown below.

## Development

Start the app at http://localhost:3000:

```bash
mise exec -- bun run dev
```

## Checks

```bash
mise exec -- bun run test
mise exec -- bun run typecheck
mise exec -- bun run build
```

## Production

Build and start the Bun server:

```bash
mise exec -- bun run build
mise exec -- bun run start
```

Use `mise exec -- bun run preview` to preview the production build locally.

## Dependency updates

```bash
mise exec -- bun update --latest
```

Commit `package.json` and `bun.lock` together. When upgrading Bun, keep the exact version in `mise.toml` and `packageManager` in sync, and update `engines.bun` to the minimum verified version.

TypeScript stays on version 6 because `vue-tsc` currently requires its JavaScript compiler API, which TypeScript 7 no longer provides. Vitest uses its threads pool because the default forks pool hangs under Bun.
