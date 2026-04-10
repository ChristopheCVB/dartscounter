# Spec: Summary, History, Settings

## Status

Implemented baseline with ongoing QA items.
Last verified against code: 2026-04-10

## Outcome

- Match completion produces a reliable summary.
- History is persisted and browseable.
- User defaults in settings prefill new match setup.

## 1) Match Summary Builder

Implemented in `app/composables/useMatchState.ts` (`computeSummary`) and `app/stores/match.ts`:

- winner
- duration
- darts thrown
- bust count
- 3-dart average
- first 9 average
- checkout attempts/made/percentage

Summary is added to history before active match state is cleared.

## 2) History Store

Implemented in `app/stores/history.ts`:

- add summary
- list summaries (newest first)
- delete summary

## 3) History Persistence

Implemented in `app/composables/usePersistence.ts`:

- save/load history collection
- versioned storage keys
- safe fallback on invalid payload

## 4) History Page

Implemented in `app/pages/history.vue`:

- date/time
- mode and settings snapshot
- winner and match mode
- duration
- empty state with new-match CTA

## 5) Summary UI

Implemented in `app/components/stats/MatchStats.vue`:

- winner highlight
- per-player stat rows
- responsive card + table layout

## 6) Settings Defaults

Implemented in `app/stores/settings.ts` and `app/pages/settings.vue`:

- default start score
- default double-in/out
- default legs target

Defaults are used to prefill `app/pages/match/new.vue` form values.

## 7) Auto-End Turn Polish

- Keep auto-end at dart 3.
- Add short transition delay so user sees throw result.
- Keep undo behavior consistent with transition timing.

This is implemented in `app/stores/match.ts` via `transitionLocked` and `lockTransition()`.

## 8) Test and QA Gate

Validate full loop:

- create match
- play with auto-end
- finish checkout
- summary displays
- summary appears in history
- refresh retains history and settings
