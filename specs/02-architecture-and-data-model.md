# Architecture and Data Model Spec

## Status

As-built architecture reference.
Last verified against code: 2026-03-01

## 1) Tech Stack

- Nuxt 4 + TypeScript
- Nuxt UI
- Pinia
- Zod (form + schema validation)
- Local persistence first (`localStorage` via `usePersistence`), optional IndexedDB path via `idb`
- Testing: Vitest (+ Vue Test Utils; E2E later)

## 2) High-Level Structure

Current folders:

```txt
app/
  app.config.ts
  app.vue
  assets/css/main.css
  components/
    match/
    setup/
    stats/
  composables/
    useScoringEngine.ts
    useMatchState.ts
    usePersistence.ts
  layouts/default.vue
  pages/
    index.vue
    match/
      new.vue
      [id].vue
    history.vue
    settings.vue
  stores/
    match.ts
    settings.ts
    history.ts
shared/
  types/darts.ts
tests/
  unit/
    scoring/
    match/
```

## 3) Responsibility Split

- `useScoringEngine.ts`
  - Pure rule logic only.
  - No UI or storage side effects.
- `useMatchState.ts`
  - Turn orchestration using scoring engine.
  - Handles progression between players/turns.
- `usePersistence.ts`
  - Save/load active match, history, and settings.
  - Versioned local keys and safe JSON fallback.
- `stores/match.ts`
  - Active match state and actions.
- `stores/settings.ts`
  - User defaults for new matches.
- `stores/history.ts`
  - Completed match summaries.
- `app/layouts/default.vue`
  - App shell with Nuxt UI `UHeader` + `UMain`/`UContainer`.

## 4) Rule Engine Specification (X01)

- Input dart shape:
  - `segment`: 1-20 or 25
  - `multiplier`: 1, 2, 3
- Turn:
  - Up to 3 darts.
  - Ends early on valid checkout.
- Bust when:
  - score goes below 0
  - score reaches 1 while `doubleOut = true`
  - score reaches 0 without valid double when `doubleOut = true`
- Bust result:
  - score reverts to start-of-turn score
  - bust stat increments
  - next player starts
- Checkout result:
  - current leg ends immediately

## 5) Core Data Shapes (Conceptual)

- `Player`: id, name, color
- `X01Settings`: startScore, doubleIn, doubleOut, legsTarget
- `Throw`: playerId, turnIndex, dartIndex, segment, multiplier, points, timestamp
- `Turn`: startScore, throws, endScore, isBust, isCheckout
- `Match`: id, settings, status, players, currentPlayerIndex, legsWon, startedAt, finishedAt
- `MatchSummary`: id, winner, duration, per-player stats, finishedAt

## 6) UI/UX Direction

- Sporty modern visual style.
- Scoreboard-first layout.
- Large, fast touch targets on mobile.
- Richer side panels on desktop.
- High contrast and clear active player state.
- Nuxt UI-first composition (header/layout/buttons/modals/cards).
