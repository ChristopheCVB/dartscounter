# Classic Cricket

## Rules

- Any room roster of at least two players can play. Player order is randomized once at match start.
- Targets are 20, 19, 18, 17, 16, 15 and Bull, in any order. Three marks close a target for a player. Singles, doubles and trebles give one, two and three marks; outer Bull gives one and inner Bull gives two.
- Marks beyond closure score the target's value while at least one opponent still has it open. Points are awarded once, regardless of opponent count. A dart may close and score simultaneously; two existing marks plus T20 closes 20 and scores 40 points. Everyone closing a target makes it unavailable for further scoring.
- A player immediately wins a leg when all seven targets are closed and their points equal or exceed every opponent's. A closed player who is behind keeps playing to catch up. There is no round limit or score cap.
- Matches are first to 1–11 legs, default one. After each non-final leg, reset everyone's marks and points, clear the turn and restart its counter. Keep cumulative stats and throws. The next starter is the next player in the original order, determined by total completed legs modulo player count, regardless of who won.
- Misses and valid non-target hits consume a dart without marks or points. Invalid segment/multiplier combinations remain rejected.

## State and persistence

- Shared types add `CricketSettings`, `CricketTarget` and `CricketMarks`; `GameMode` includes `cricket`.
- The pure Cricket engine calculates updated capped target marks, scored points and productive marks. Match progression determines leg wins and completion. Only the server accepts scoring actions.
- Each Cricket player starts with a separate zeroed marks map. `score` holds current-leg points. `stats.scoredPoints` and `stats.scoredMarks` accumulate across the whole match. Dart events retain raw dart points, counted points, productive marks, score before/after and the existing completion flag for a leg-winning dart; X01 checkout statistics remain zero.
- Existing JSON state and bounded full-state undo snapshots persist all Cricket fields. Undo restores marks, points, turn order, leg wins and completed results atomically, including across leg resets. No SQL migration is needed.
- Account preferences include separate `cricketSettings`, defaulting to one leg when absent. Preference updates that omit Cricket settings retain the saved value or default. Selecting Cricket in the lobby seeds its draft from the owner's saved default; room saves never overwrite account defaults. Play again retains saved room rules.

## Interface and statistics

- The lobby offers Cricket and legs-to-win. Settings has a separate default Cricket legs-to-win field. Rule summaries explain the seven targets, three-mark closure, 25/50 Bull, winning condition, legs target and rotating starter.
- The scoreboard is a shared target-row/player-column table with current-leg points and legs won. Use —, /, × and ⊗ for zero through three marks, with a legend and accessible cell labels. Highlight the current player and mute globally closed rows. Horizontal scrolling stays within the scoreboard with a sticky target column.
- The interactive dartboard records all valid hits. Quick Input shows 15–20, single/double/treble, both Bulls and Miss. Numeric point entry stays X01-only. The turn timeline shows productive marks and points separately. There are no tactical Cricket recommendations.
- Recap and History show legs, total points earned across all legs, marks per round (MPR) and actual darts thrown. Recap order is legs descending, MPR descending, points descending, then name.
- Productive marks contribute toward closing a target or earning points; discarded overflow and globally closed targets give none. MPR is `scoredMarks / dartsThrown * 3`, zero before any darts, displayed to two decimals. It uses actual darts, including misses and the final partial turn. Lifetime Cricket statistics aggregate raw marks and darts before calculating MPR, isolated from other modes. Profiles show matches, wins, points, darts and MPR.
- Only a match win plays the existing celebration. Individual darts and intermediate leg wins are silent. Existing controller, spectator, retry, reconnect, room-lifetime and history-visibility rules apply.

Cut-throat, no-score Cricket, teams, handicaps and round limits are outside this mode.
