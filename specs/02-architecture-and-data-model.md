# Architecture and Data Model Spec

## Status

As-built architecture reference.
Last verified against code: 2026-04-10

## 1) Tech Stack

- Nuxt 4 + TypeScript
- Nuxt UI
- Tailwind CSS v4
- Pinia
- @vueuse/nuxt
- Zod (form + schema validation)
- @vueuse/sound (throw sounds)
- canvas-confetti (checkout celebration)
- Local persistence first (`localStorage` via `usePersistence`)
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
    usePlayerStats.ts
    useThrowSounds.ts
  constants/
    playerColors.ts
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
    players.ts
shared/
  types/darts.ts
tests/
  unit/
    scoring/
    match/
```

## 3) Responsibility Split

- `useScoringEngine.ts`
  - Pure rule logic only. Exports bare functions (not a Vue composable).
  - No UI or storage side effects.
- `useMatchState.ts`
  - Turn orchestration using scoring engine.
  - Handles progression between players/turns.
- `usePersistence.ts`
  - Save/load active match, history, settings, and recent players.
  - Versioned local keys (`dartcounter:v1:*`) and safe JSON fallback.
- `usePlayerStats.ts`
  - Pure utility (not a Vue composable). Exports bare functions.
  - `aggregatePlayerStats()` groups `MatchSummary` entries by player and computes lifetime `AggregatedPlayerStats[]`.
- `useThrowSounds.ts`
  - Sound feedback via `@vueuse/sound`.
  - Returns `{ playForThrow, playConfetti }`; respects `soundEnabled` from settings store.
- `stores/match.ts`
  - Active match state and actions.
- `stores/settings.ts`
  - User defaults for new matches.
- `stores/history.ts`
  - Completed match summaries.
- `stores/players.ts`
  - Recent player identities (name + color) persisted across matches.
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

## 5) Core Data Shapes

**Type aliases:**
- `Multiplier`: `1 | 2 | 3`
- `Segment`: `0 | 1–20 | 25` (0 = miss, 25 = bull)
- `MatchStatus`: `'setup' | 'in_progress' | 'finished'`

**Interfaces:**
- `DartInput`: segment + multiplier
- `DartApplyResult`: result of `applyDart()` — points, scoredPoints, nextScore, nextOpened, isBust, isCheckout
- `ThrowEvent`: DartInput + full metadata (id, playerId, turnIndex, dartIndex, points, scoredPoints, scoreBefore/After, openedBefore/After, isBust, isCheckout, timestamp)
- `X01Settings`: startScore (301 | 501), doubleIn, doubleOut, legsTarget
- `PlayerIdentity`: id, name, color — base identity; `Player` extends it
- `Player`: extends `PlayerIdentity`
- `PlayerStats`: per-match stats counters — dartsThrown, busts, checkoutAttempts, checkoutsMade, scoredPoints, firstNinePoints, firstNineDarts
- `MatchPlayer`: Player + score, hasOpened, legsWon, stats: PlayerStats
- `Match`: id, settings, status, players[], currentPlayerIndex, currentTurnIndex, currentTurnStartScore, currentTurnOpenedAtStart, currentTurnDarts[], throws[], startedAt, finishedAt, winnerId
- `PlayerSummary`: post-match per-player stats (averages, checkout %, etc.)
- `MatchSummary`: id, matchId, finishedAt, durationMs, mode, players: PlayerSummary[], winnerId, winnerName

> Note: turns are not a standalone type — turn state is tracked via `currentTurn*` fields in `Match`.

## 6) UI/UX Direction

- Sporty modern visual style.
- Scoreboard-first layout.
- Large, fast touch targets on mobile.
- Richer side panels on desktop.
- High contrast and clear active player state.
- Nuxt UI-first composition (header/layout/buttons/modals/cards).
