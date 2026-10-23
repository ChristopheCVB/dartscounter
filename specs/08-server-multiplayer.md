# Server persistence and multiplayer

This specification supersedes the localStorage/no-auth requirements in specifications 01–07. Existing game rules and input methods remain authoritative.

## Accounts and data

- Independent Better Auth accounts: verified email/password, password reset, Resend delivery, Turnstile protection.
- Verification/password-reset emails use local Vue templates and a shared layout through `nuxt-email-renderer`. Both HTML and plain text are rendered with template-defined subjects; delivery errors propagate to auth. Development previews use fictional props and never send mail.
- PostgreSQL 18 stores settings, account-owned player profiles, temporary rooms, membership deadlines, matches, undo state, action receipts, and history visibility. Completed matches remain independent of room lifetime.
- Existing browser data is untouched and is not imported. All play requires an account and an internet connection.
- Each account has its own player identity and can create named/color-coded guests. Guest identities belong to that account; names never link accounts.
- Removing or clearing guests removes them from waiting-room rosters and clears everyone's readiness in affected rooms. Running matches retain their player snapshots until they finish or are abandoned; deleted guests are then removed from the lobby. Recreating a deleted name creates a fresh identity and statistics, while past results keep the old identity. Loading an existing lobby also removes stale deleted guests.
- Finished matches are shared with participating accounts. Hiding a history entry affects only that account and its lifetime statistics. Profile changes preserve match snapshots.

## Rooms

- Signed-in users create a temporary room or join with an eight-character code. Each account, including spectators, belongs to at most one room; creating or joining another requires leaving first. Owners can rotate codes or remove members between matches.
- Explicit Leave removes membership immediately. Otherwise, five minutes without client contact from a room or match page removes the account. Visiting History, Settings, or Play starts this window; another open tab in the same room keeps membership alive. Server SSE timers do not renew membership.
- Membership deadlines survive restarts. Startup and a five-second cleanup loop apply overdue departures; room operations also check expiry under the room lock. Reconnecting before expiry renews membership; reconnecting after expiry cannot revive it. A room-page client refresh within fifteen seconds marks the member connected; otherwise the interface shows a reconnect countdown.
- When the owner leaves, ownership passes to a connected remaining member, preferring the longest-standing member and using account ID for ties; if everyone is reconnecting, the longest-standing remaining member takes over. Membership changes clear readiness, and disconnected selected accounts cannot start a match.
- A participating account leaving or expiring abandons its unfinished match without a winner and releases all active-match reservations. Departing spectators do not end a match. A participant leaving after completion locks the result against undo.
- The last departure deletes the room, invalidates its invite code, and removes unfinished matches and temporary action data. Completed matches, player snapshots, participant records, hidden-history choices, and lifetime statistics remain. No room archive or reusable saved group is retained.
- Each account selects its own players or watches with an empty roster. Adding a guest in the lobby selects that guest and saves the account's roster. Selected accounts must all mark Ready. Changing rules or a roster clears readiness.
- The owner starts with at least two uniquely named players; order is randomized. X01 and Around the Clock use all existing rule options.
- Joining during a match allows watching; the roster stays fixed until the next match. An account may participate in only one active match.
- Only each account can score for itself and its guests. Play waits when an absent controller's turn arrives during the reconnect window; expiration ends the unfinished match. Ownership transfers on departure, after the reconnect window for an absent owner.
- Any current-match participant may undo the latest dart, including a winning dart until the next match starts or a participant leaves. Spectators cannot undo. Undo is persisted, bounded to the last 200 darts, and restores turns, legs, statistics, and completion atomically.
- The owner can abandon a running match without a winner or completed statistics. While people remain, Play again returns to the same lobby with players and rules retained and readiness cleared. Starting another match locks previous results.
- One-device play uses the same server implementation, with one account controlling its selected local players. One signed-in account playing with a guest satisfies the two-player minimum; only that account marks Ready, then the owner starts. Guests need no account or separate readiness.
- Lobby errors use toasts without shifting the layout; connection status and pending-action recovery remain visible. Repeated identical connection failures do not stack notifications.
- Saved rules are visible to everyone in the lobby and inside the match’s Match Status panel, including straight/double in and out, start score and legs target for X01, or target order and Fast Forward for Around the Clock.
- X01 player cards show the current match’s three-dart average (`scoredPoints / dartsThrown × 3`, or zero before any darts) to the left of remaining points, with two decimal places and smaller, muted text. Around the Clock keeps its target display.
- Each player card shows recommendations from that player's own state: remaining darts for the active player, or a fresh three-dart turn for waiting players. Recommendations disappear after completion or abandonment; the current-turn timeline shows thrown darts.
- Match errors and pending-dart recovery appear in a floating notification outside the match layout. Recovery appears only after an unresolved request, with the original request retained for retry. Saving, connection, and turn-transition messages share a stable status area so scoring does not shift the Match Status panel or player list.

## Authority and synchronization

- Shared pure engines implement scoring and match progression; the server invokes them after authorization and input validation.
- Authenticated scoring and lobby actions contain a request ID and expected room revision. PostgreSQL transactions lock the room and serialize accepted actions. Retries return the recorded result; stale actions require a refresh. Leaving uses an idempotent membership deletion with the expected revision; retries after removal succeed, and an old revision cannot remove a newly rejoined membership.
- Room-scoped SSE signals committed revisions. Clients subscribe before loading state, refetch on reconnect, ignore old revisions, and disable scoring while disconnected or pending. Session/membership checks continue during streaming.
- An ambiguous network failure retains its request ID for explicit retry. It is never replayed against a new turn with a new ID.
- Live notifications support one Bun instance. PostgreSQL retains all authoritative data and restores rooms after restart.
- Optional consola request logging is enabled by `REQUEST_LOGGING_ENABLED=true`. SSE opening/closure follows the actual stream lifecycle, including browser cancellation; queries and reset tokens are redacted.

## Operations

- Migrations run before serving traffic under a PostgreSQL advisory lock and fail startup on error. Docker includes the migration files.
- The temporary-room migration clears existing rooms and unfinished matches, including games running at deployment. It preserves and locks completed results, their participant records, and per-account history visibility.
- Configure the database URL, independent Better Auth secret and public origin, Resend sender/key, and Turnstile keys. Production uses real keys; tests use isolated accounts and a database ending in `_test`.
- Coolify must support unbuffered SSE and a health check at `/api/health`. PostgreSQL requires a persistent volume and backups.

## Turn audio

- Individual darts are silent in both modes. X01 announces the counted three-dart total, including zero; darts before double-in do not contribute. Every bust immediately plays the existing miss sound without announcing a total. All checkouts suppress totals; only a match win plays the existing celebration sound and visual confetti. Around the Clock has only its match-win celebration.
- Special recordings announce 100, 140, and 180 in their original voice, regardless of the selected speech language. Other scores use native browser TTS and speak only the number. Recording failures fall back to TTS.
- All connected viewers hear accepted live results once. Initial loads and reconnect catch-up are silent. The newest completed result interrupts previous audio; undo, disconnect, abandonment, mute, or replacing the match cancels playback.
- The account-saved sound switch controls all audio. Announcement language and voice are browser-local preferences, preserved through account hydration and logout. Device language and its default voice are used initially; unavailable saved voices fall back to the selected language’s default. Settings provides a voice preview, language/voice selection, and speech availability/error feedback. Unsupported speech never blocks scoring.
