# DartCounter — Agent Guide

Concise map of the codebase for AI agents and developers. Authoritative behavior and data model live in **specs/**.

## Project overview

- **What:** DartCounter — local X01 darts scoring app (301/501, pass-and-play, bust/checkout, undo, stats, persistence).
- **Stack:** Nuxt 4, Nuxt UI, Pinia, VueUse, TypeScript, Zod, Vitest. Local-first (localStorage; optional idb).
- **Audience:** One device, friends playing locally; responsive mobile/desktop.

## Directory map

- **app/** — Nuxt 4 app source:
  - **pages/** — Routes: `index`, `match/new`, `match/[id]`, `history`, `settings`.
  - **components/** — Feature folders: `match/` (Scoreboard, PlayerCard, ThrowPad, InteractiveTarget, TurnTimeline), `setup/` (MatchConfigForm), `stats/` (MatchStats).
  - **composables/** — `useScoringEngine`, `useMatchState`, `usePersistence`, `usePlayerStats`, `useThrowSounds`.
  - **stores/** — Pinia: `match`, `settings`, `history`, `players`.
  - **layouts/default.vue** — App shell (UHeader, UMain, UContainer, nav).
  - **assets/css/main.css**, **app.config.ts** (Nuxt UI theme: primary orange, etc.), **constants/playerColors.ts**.
- **shared/** — Non-Nuxt shared code:
  - **types/darts.ts** — Single source of truth for X01 types: `Segment`, `Multiplier`, `DartInput`, `ThrowEvent`, `X01Settings`, `Player`, `Match`, `MatchPlayer`, `MatchSummary`, etc.
- **specs/** — Product and implementation specs (MVP, architecture, data model, day-by-day notes). See [specs/README.md](specs/README.md) for reading order.
- **tests/** — Vitest: `unit/scoring/useScoringEngine.test.ts`, `unit/match/useMatchState.test.ts`.
- **Config:** [nuxt.config.ts](nuxt.config.ts) — modules `@nuxt/ui`, `@pinia/nuxt`, `@vueuse/nuxt`; Pinia `storesDirs: ['app/stores/**']`; CSS from `~/assets/css/main.css`.

## Responsibility split

- **useScoringEngine.ts** — Pure X01 rule logic only (no UI, no storage).
- **useMatchState.ts** — Turn orchestration and progression using the scoring engine.
- **usePersistence.ts** — Save/load active match, history, settings (versioned keys, JSON fallback).
- **Stores** — `match` (active game), `settings` (defaults), `history` (summaries), `players`.
- **app.vue** — On mount: loads settings, history, active match, players from stores.

## Conventions

- **Components:** PascalCase filenames; Nuxt auto-import with directory prefix (e.g. `MatchScoreboard`, `MatchThrowPad`).
- **Composables:** `use*`; **Stores:** `use*Store` (e.g. `useMatchStore`).
- **Types:** Import from `shared/types/darts.ts`; do not redefine core darts types in `app/`.
- **UI:** Nuxt UI components (`UApp`, `UCard`, `UButton`, etc.); theming in `app.config.ts`. Custom CSS classes (e.g. `arcade-glow`) in `app/assets/css/main.css`.
- **Shortcuts:** Match page uses Nuxt UI `defineShortcuts` for keyboard shortcuts.

## Commands

- **Dev:** `pnpm dev` (or npm/bun equivalent) — http://localhost:3000
- **Build:** `pnpm build`; **Preview:** `pnpm preview`
- **Tests:** `pnpm test` (Vitest run); `pnpm test:watch` for watch mode

## Agent guidance

- **Behavior and scope:** Use [specs/](specs/) as source of truth (MVP, architecture, data model). Start with [specs/01-product-mvp.md](specs/01-product-mvp.md) and [specs/02-architecture-and-data-model.md](specs/02-architecture-and-data-model.md) when changing game behavior or structure.
- **New features:** Follow existing patterns (composables for logic, stores for app state, types in `shared/types/darts.ts`). Add or extend Vitest unit tests for scoring and match state changes.
- **UI changes:** Prefer Nuxt UI primitives and existing layout; keep custom styles in `app/assets/css/main.css` and theme in `app.config.ts`.
