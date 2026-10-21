# Server persistence and multiplayer

This specification supersedes the localStorage/no-auth requirements in specifications 01–07. Existing game rules and input methods remain authoritative.

## Accounts and data

- Independent Better Auth accounts: verified email/password, password reset, Resend delivery, Turnstile protection.
- Verification/password-reset emails use local Vue templates and a shared layout through `nuxt-email-renderer`. Both HTML and plain text are rendered with template-defined subjects; delivery errors propagate to auth. Development previews use fictional props and never send mail.
- PostgreSQL 18 stores settings, account-owned player profiles, rooms, membership, matches, undo state, action receipts, and history visibility.
- Existing browser data is untouched and is not imported. All play requires an account and an internet connection.
- Each account has its own player identity and can create named/color-coded guests. Guest identities belong to that account; names never link accounts.
- Finished matches are shared with participating accounts. Hiding a history entry affects only that account and its lifetime statistics. Profile changes preserve match snapshots.

## Rooms

- Signed-in users create a room or join with an eight-character code. Membership and codes survive restarts. Owners can rotate codes or remove members between matches.
- Each account selects its own players or watches with an empty roster. Adding a guest in the lobby selects that guest and saves the account's roster. Selected accounts must all mark Ready. Changing rules or a roster clears readiness.
- The owner starts with at least two uniquely named players; order is randomized. X01 and Around the Clock use all existing rule options.
- Joining during a match allows watching; the roster stays fixed until the next match. An account may participate in only one active match.
- Ownership does not transfer on disconnection. Only each account can score for itself and its guests. Play waits when an absent controller's turn arrives.
- Any current-match participant may undo the latest dart, including a winning dart until the next match starts. Spectators cannot undo. Undo is persisted, bounded to the last 200 darts, and restores turns, legs, statistics, and completion atomically.
- The owner can abandon a running match without a winner or completed statistics. A room is reusable after completion or abandonment. Starting another match locks previous results.
- One-device play uses the same server implementation, with one account controlling its selected local players. One signed-in account playing with a guest satisfies the two-player minimum; only that account marks Ready, then the owner starts. Guests need no account or separate readiness.
- Lobby errors use toasts without shifting the layout; connection status and pending-action recovery remain visible. Repeated identical connection failures do not stack notifications.
- Saved rules are visible to everyone in the lobby and inside the match’s Match Status panel, including straight/double in and out, start score and legs target for X01, or target order and Fast Forward for Around the Clock.
- Each player card shows recommendations from that player's own state: remaining darts for the active player, or a fresh three-dart turn for waiting players. Recommendations disappear after completion or abandonment; the current-turn timeline shows thrown darts.
- Match errors and pending-dart recovery appear in a floating notification outside the match layout. Recovery appears only after an unresolved request, with the original request retained for retry. Saving, connection, and turn-transition messages share a stable status area so scoring does not shift the Match Status panel or player list.

## Authority and synchronization

- Shared pure engines implement scoring and match progression; the server invokes them after authorization and input validation.
- Authenticated HTTP actions contain a request ID and expected room revision. PostgreSQL transactions lock the room and serialize accepted actions. Retries return the recorded result; stale actions require a refresh.
- Room-scoped SSE signals committed revisions. Clients subscribe before loading state, refetch on reconnect, ignore old revisions, and disable scoring while disconnected or pending. Session/membership checks continue during streaming.
- An ambiguous network failure retains its request ID for explicit retry. It is never replayed against a new turn with a new ID.
- Live notifications support one Bun instance. PostgreSQL retains all authoritative data and restores rooms after restart.
- Optional consola request logging is enabled by `REQUEST_LOGGING_ENABLED=true`. SSE opening/closure follows the actual stream lifecycle, including browser cancellation; queries and reset tokens are redacted.

## Operations

- Migrations run before serving traffic under a PostgreSQL advisory lock and fail startup on error. Docker includes the migration files.
- Configure the database URL, independent Better Auth secret and public origin, Resend sender/key, and Turnstile keys. Production uses real keys; tests use isolated accounts and a database ending in `_test`.
- Coolify must support unbuffered SSE and a health check at `/api/health`. PostgreSQL requires a persistent volume and backups.
