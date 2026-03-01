# Day 2 Spec: Playable Match Loop

## Status

Implemented baseline with ongoing QA items.
Last verified against code: 2026-03-01

## Outcome

Current Day 2 outcomes:

- User can create a match and play it.
- Throw entry, turn rotation, bust/checkout, and undo work.
- Active match persistence works across refresh.

## 1) Match Setup Form

Implemented in `app/components/setup/MatchConfigForm.vue` with:

- players (2 to unlimited)
- start score (301/501)
- double-in toggle
- double-out toggle
- legs target

Validation uses Zod and emits a normalized payload.

## 2) Match Creation Flow

Implemented in `app/pages/match/new.vue`:

- submit validated setup
- update defaults in settings store
- create/replace active match in match store
- navigate to `/match/[id]`

## 3) Match Store Actions

Implemented in `app/stores/match.ts`:

- start match
- record dart
- resolve turn
- advance player
- undo last dart
- finish leg/match (via state composable + summary handoff)

Scoring decisions remain in `useScoringEngine.ts`.

## 4) Match Orchestration

Implemented in `app/composables/useMatchState.ts`:

- compute current turn state
- apply engine results
- manage bust resets and checkout flow
- manage auto-end after 3 darts
- build match summary data on completion

## 5) Live Match UI

`app/pages/match/[id].vue` hosts:

- `Scoreboard`
- `ThrowPad`
- current turn feedback and status panel

`app/components/match/ThrowPad.vue` supports:

- quick board throw entry
- interactive target entry
- miss input
- undo

## 6) Active Match Persistence

Implemented in `app/composables/usePersistence.ts`:

- save active match after each state-changing action
- load active match on app start
- include versioned storage keys

## 7) Flow Tests

Automated test coverage currently focuses on:

- 3-dart turn auto-advances
- bust resets and advances
- checkout ends immediately
- undo restores expected state
- scoring and match-state behavior in unit tests

Manual verification still recommended for full browser rehydration flow.

## 8) QA Gate (Ongoing)

Complete a full local 301/501 game manually and verify:

- score correctness
- stable turn flow
- persistence integrity
- responsive behavior on phone and desktop
