# Product and MVP Spec

## Status

Product baseline for the current implementation.
Last verified against code: 2026-03-01

## 1) Product Direction

- Build a fast, no-login darts scorer for local pass-and-play.
- Focus on X01 only for v1: 301/501.
- Prioritize trust in scoring correctness and speed of input.

## 2) MVP Scope

- Create match -> configure players/settings -> play throws -> end match -> show summary.
- Support 2-6 local players.
- Rules supported:
  - Start score: 301 or 501
  - Optional double-in
  - Optional double-out
  - Bust handling
  - Checkout handling
- Undo support: undo last dart.
- Basic stats per player:
  - 3-dart average
  - first 9 average
  - checkout attempts / made / percentage
  - darts thrown
  - bust count
- Local persistence:
  - restore active match after refresh
  - keep completed match history

## 3) Non-Goals for v1

- No authentication
- No cloud sync
- No Cricket mode
- No public multiplayer or accounts

## 4) Acceptance Criteria

- A full 501 match with 2+ players can be completed end-to-end.
- Bust and checkout rules are correct in edge cases.
- Undo last dart works reliably.
- Active match and history persist through reload.
- UI is usable on both phone and desktop.

## 5) Post-MVP Candidates

- Cricket mode
- Player profiles and longitudinal stats
- Import/export JSON
- Cloud sync and auth
- PWA install/offline enhancements
