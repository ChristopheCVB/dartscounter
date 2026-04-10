# Spec: Recent Players and Lifetime Stats

## Status

As-built reference for features added after Day 3.
Last verified against code: 2026-04-10

## Outcome

- Player identities (name + color) persist across matches so users don't re-enter them each game.
- A lifetime stats view aggregates performance across all completed matches.

---

## 1) Recent Players (`stores/players.ts`)

Store ID: `'players'`

**State:**
- `recentPlayers: PlayerIdentity[]` — ordered list of known players (most recently used first)

**Computed:**
- `recentNames` — flat array of name strings for quick lookup

**Actions:**
| Action | Description |
|---|---|
| `load()` | Hydrates store from `usePersistence` on app mount |
| `rememberMany(players)` | Upserts multiple players (add or update name/color) |
| `ensureMany(seeds)` | Ensures listed players exist; adds missing ones |
| `addRecentPlayer(player)` | Adds a single new player identity |
| `renameRecentPlayer(id, name)` | Updates name for a known player |
| `updateRecentPlayerColor(id, color)` | Updates color for a known player |
| `removeRecentPlayer(id)` | Removes a player from the list |
| `clearRecentPlayers()` | Wipes all recent players |

**Persistence:**
- Stored via `usePersistence` using key `dartcounter:v1:recentPlayers`.
- Serialized as `StoredRecentPlayer[]` (alias for `PlayerIdentity`).
- Loaded in `app.vue` on mount alongside settings and history.

---

## 2) Recent Player Persistence (`usePersistence`)

Two operations were added to `usePersistence` to support the players store:

- `saveRecentPlayers(players: StoredRecentPlayer[]): void`
- `loadRecentPlayers(): StoredRecentPlayer[]`

Both use the same safe localStorage wrapper with `import.meta.client` guard and JSON error handling as the other persistence operations.

---

## 3) Lifetime Stats Aggregation (`usePlayerStats.ts`)

**Export:** `aggregatePlayerStats(entries, recentPlayers): AggregatedPlayerStats[]`

Not a Vue composable — a plain utility function.

**Input:**
- `entries: MatchSummary[]` — full match history from `history` store
- `recentPlayers: PlayerIdentity[]` — known players from `players` store (used to resolve names for players who may not appear in history)

**Output:** `AggregatedPlayerStats[]` — one entry per player with:
- `playerId`, `name`, `color`
- `matchesPlayed`, `matchesWon`
- `dartsThrown`, `busts`
- `checkoutAttempts`, `checkoutsMade`, `checkoutPercentage`
- `scoredPoints`, `average` (scoredPoints / dartsThrown × 3)
- `firstNinePoints`, `firstNineDarts`, `firstNineAverage`

**Sorting:** by `matchesPlayed` descending, then by `name` ascending.

**Usage:** called in `history.vue` (or stats components) to render a cross-match leaderboard.
