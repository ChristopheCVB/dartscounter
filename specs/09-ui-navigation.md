# Navigation and interface

This specification supersedes the navigation and page-layout descriptions in specifications 01–07. Server authority and game behavior in specification 08 are unchanged.

## Shared interface

- Dark slate interface with orange accents, consistent headings, aligned form sections, and touch-friendly controls. Use spacing and dividers instead of nested cards.
- Main navigation: Play, Players, History, Settings. Desktop uses header links; phones use a header menu.
- The match scoring layout, controls, keyboard shortcuts, and recap are preserved. Its shared header, background, and base theme follow the app.
- The authenticated session is fetched during SSR using request cookies and hydrated into the client. Home and the header share this session so signed-in visitors do not see a signed-out flash. Account data is loaded with the same request context.

## Pages

- `/`: signed-out visitors see a compact welcome with sign-in and account creation. Signed-in visitors can resume an active match, set up one-device play, create/join rooms, and return to existing rooms.
- Room lists show Lobby, Playing, Finished, or Abandoned and link directly to running matches. The account’s active room is tracked independently of the room currently being viewed. A different lobby identifies the blocking room and links to resume it or open its lobby to abandon it; users can refresh the status after another device finishes the match. Deleting saved guests never releases an active match reservation.
- `/rooms`: redirects to Play. Default authentication destinations also lead to Play; safe explicit return destinations are preserved.
- `/match/new`: one-page setup with Players followed by Rules, arranged side by side on desktop. Initially select the account player and an empty guest; either is replaceable. Late account hydration must not overwrite edits. Existing rules, validation, two-player minimum, active-match protection, and pending-action recovery apply.
- `/room/[id]`: invite/copy controls, persistent connection and readiness information, member list, roster selection, and saved rules. Owner edits remain explicit saves. Explain unsaved edits and disabled Ready/Start actions. Adding a guest still selects and saves it, as specified in 08. Spectator, owner, and running-match permissions remain unchanged.
- `/players`: player creation and name/color editing through dialogs, a mode switch for lifetime statistics, a desktop table, and phone rows with expandable details. Name and color updates use one existing player API transaction. The account player cannot be removed; historical snapshots are preserved.
- `/history`: compact results with expandable full statistics; use stacked statistics on phones. “Hide from my history” affects only the current account and its aggregate statistics.
- `/settings`: match defaults and audio preferences with one explicit save. Language/voice remain browser-local, with preview and speech feedback.
- Authentication pages: narrow forms, contextual links, visible success/error states, and existing CAPTCHA, verification, password-reset, and validation behavior.

Removal actions live in overflow menus and require confirmation: hiding history, removing saved guests or room members, clearing guests, and abandoning a match. Invite-code rotation also confirms that the old code will stop working.
