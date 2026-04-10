# Spec: Bootstrap and Scoring Engine

## Status

Implemented baseline.
Last verified against code: 2026-04-10

## Outcome

Implemented baseline:

- App boots with Bun.
- Nuxt UI and Pinia are wired.
- Route and layout skeleton exists.
- X01 scoring engine is implemented with unit tests.

## 1) Bootstrap and Modules

- Nuxt app initialized and running on Bun scripts.
- `@nuxt/ui` and `@pinia/nuxt` are enabled in `nuxt.config.ts`.
- `zod` is present in dependencies.

## 2) App Shell and Theming

- App shell uses Nuxt UI layout primitives (`UHeader`, `UMain`, `UContainer`) in `app/layouts/default.vue`.
- UI colors are runtime-configured in `app/app.config.ts`.
- Global CSS is intentionally minimal in `app/assets/css/main.css` (`@import` + `@theme` font token).

## 3) Shared Types

- Shared model types are defined in `shared/types/darts.ts`.
- Types cover match state, throw events, summaries, settings, and engine input/output.

## 4) Scoring Engine

- Implemented in `app/composables/useScoringEngine.ts` as pure logic.
- Includes points calculation, bust detection, checkout validation, dart application, and numeric parsing.
- Double-in/double-out and bust revert rules are enforced.

## 5) Unit Tests

- Engine tests are in `tests/unit/scoring/useScoringEngine.test.ts`.
- Match-state flow tests are in `tests/unit/match/useMatchState.test.ts`.
- Current command: `bun run test`.

## 6) Stores and Routes

- Initial stores are implemented and expanded in:
  - `app/stores/match.ts`
  - `app/stores/settings.ts`
  - `app/stores/history.ts`
  - `app/stores/players.ts`
- Route skeleton from this phase is now fully playable and integrated.
