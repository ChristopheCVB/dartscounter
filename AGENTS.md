# DartsCounter — Agent Guide

Concise map of the codebase for AI agents and developers. Authoritative behavior and data model live in **specs/**.

## Project overview

- **Server behavior:** See [specs/08-server-multiplayer.md](specs/08-server-multiplayer.md), which supersedes local-only persistence and authentication requirements.
- **What:** DartsCounter — local X01 darts scoring app (301/501, pass-and-play, bust/checkout, undo, stats, persistence).
- **Stack:** Nuxt 4, Nuxt UI, Tailwind CSS v4, Pinia, VueUse, @vueuse/sound, canvas-confetti, TypeScript, Zod, Vitest. PostgreSQL 18, Drizzle, Better Auth, and server-sent room updates.
- **Audience:** One device, friends playing locally; responsive mobile/desktop.

## Directory map

- **app/** — Nuxt 4 app source:
  - **pages/** — Routes: `index`, `match/new`, `match/[id]`, `history`, `settings`.
  - **components/** — Feature folders: `match/` (Scoreboard, PlayerCard, ThrowPad, InteractiveTarget, TurnTimeline), `setup/` (MatchConfigForm), `stats/` (MatchStats).
  - **composables/** — `useAuth`, `useThrowSounds`; scoring and progression live in `shared/utils/`.
  - **stores/** — Pinia: `match`, `settings`, `history`, `players`.
  - **layouts/default.vue** — App shell (UHeader, UMain, UContainer, nav).
  - **assets/css/main.css**, **app.config.ts** (Nuxt UI theme: primary orange, etc.), **shared/utils/playerColors.ts**.
- **shared/** — Non-Nuxt shared code:
  - **types/darts.ts** — Single source of truth for X01 types: `Multiplier`, `Segment`, `MatchStatus`, `DartInput`, `ThrowEvent`, `DartApplyResult`, `X01Settings`, `PlayerIdentity`, `Player`, `PlayerStats`, `MatchPlayer`, `Match`, `PlayerSummary`, `MatchSummary`.
- **specs/** — Product and implementation specs (MVP, architecture, data model, feature implementation notes). See [specs/README.md](specs/README.md) for reading order.
- **tests/** — Vitest projects `unit/`, `nuxt/`, `integration/`, and `e2e/`; paths within each project mirror the source tree (e.g. `unit/shared/utils/scoringEngine.test.ts`, `nuxt/app/components/setup/MatchConfigForm.test.ts`, `e2e/app/pages/match/[id].test.ts`). All test files are included in `bun run typecheck`.
- **Config:** [nuxt.config.ts](nuxt.config.ts) — modules `@nuxt/ui`, `@pinia/nuxt`, `@vueuse/nuxt`; Pinia `storesDirs: ['app/stores/**']`; CSS from `~/assets/css/main.css`.
- **Runtime:** Bun is pinned in `mise.toml`; `bunfig.toml` sets `run.bun = true` so `bun run` executes package scripts and child commands with Bun.

## Responsibility split

- **shared/utils/scoringEngine.ts** — Pure X01 rule logic only (no UI, no storage). Exports bare functions, not a Vue composable.
- **shared/utils/matchState.ts** — Turn orchestration and progression using the scoring engine.
- **server/** — Authenticated APIs, PostgreSQL transactions, room authorization, live events, and startup migrations.
- **shared/utils/** — Pure scoring engines, match progression, statistics, and API validation.
- **shared/utils/playerStats.ts** — Exports bare `aggregatePlayerStats()` for computing lifetime `AggregatedPlayerStats[]` from match history. Not a Vue composable.
- **useThrowSounds.ts** — Sound feedback via `@vueuse/sound`; returns `{ playForThrow, playConfetti }`.
- **Stores** — `match` (active game), `settings` (defaults), `history` (summaries), `players` (recent player identities).
- **app.vue** — Loads server-backed account data when the authenticated session changes. Stores cache views; the server owns accepted match actions.

## Conventions

- **Components:** PascalCase filenames; Nuxt auto-import with directory prefix (e.g. `MatchScoreboard`, `MatchThrowPad`).
- **Composables:** `use*`; **Stores:** `use*Store` (e.g. `useMatchStore`).
- **Types:** Import from `shared/types/darts.ts`; do not redefine core darts types in `app/`.
- **UI:** Nuxt UI components (`UApp`, `UCard`, `UButton`, etc.); theming in `app.config.ts`. Custom CSS classes (e.g. `arcade-glow`) in `app/assets/css/main.css`.
- **Shortcuts:** Match page uses Nuxt UI `defineShortcuts` for keyboard shortcuts.

## Commands

- **Dev:** `bun run dev` — http://localhost:3000
- **Build:** `bun run build`; **Preview:** `bun run preview`
- **Tests:** `bun run test` (Vitest run); `bun run test:watch` for watch mode
- **Test projects:** `bun run test:unit`, `bun run test:nuxt`, `bun run test:e2e`; Chromium setup: `bunx --bun playwright-core install --with-deps chromium`
- **Lint / types:** `bun run lint`; `bun run lint:fix`; `bun run typecheck` (includes the Bun/vue-tsc preload)
- **CI / deployment:** `.github/workflows/` uses self-hosted runners; release-please calls Coolify after releases. Setup requirements are in `README.md`.

## Agent guidance

- **Behavior and scope:** Use [specs/](specs/) as source of truth (MVP, architecture, data model). Start with [specs/README.md](specs/README.md) for reading order; [specs/01-product-mvp.md](specs/01-product-mvp.md) and [specs/02-architecture-and-data-model.md](specs/02-architecture-and-data-model.md) for game behavior and structure; implementation specs (03–07) for feature-level decisions.
- **New features:** Follow existing patterns (composables for logic, stores for app state, types in `shared/types/darts.ts`). Add or extend Vitest unit tests for scoring and match state changes.
- **UI changes:** Prefer Nuxt UI primitives and existing layout; keep custom styles in `app/assets/css/main.css` and theme in `app.config.ts`.
