# Navigation and interface

This specification supersedes the navigation and page-layout descriptions in specifications 01–07. Server authority and game behavior in specification 08 are unchanged.

## Shared interface

- Dark slate interface with orange accents, consistent headings, aligned form sections, and touch-friendly controls. Use spacing and dividers instead of nested cards.
- Main navigation: Play, Players, History, Settings. Desktop uses header links; phones use a header menu.
- The match scoring layout, controls, keyboard shortcuts, and recap are preserved. Its shared header, background, and base theme follow the app.
- The authenticated session is fetched during SSR using request cookies and hydrated into the client. Home and the header share this session so signed-in visitors do not see a signed-out flash. Account data is loaded with the same request context.
- Pages define English titles and descriptions. Browser titles use `Page - DartsCounter`; Open Graph and Twitter tags share the page title and description. Room and match metadata stays generic, without player names, scores, or invite codes. Only Play permits search indexing; other pages use `noindex, nofollow`.

## Pages

- `/`: signed-out visitors see a compact welcome with sign-in and account creation. Signed-in visitors see one Current room panel with member/player names, ownership, connection/reconnect status, saved rules, and Playing or Between matches activity. Return to room, Open match when running, and Leave room are explicit actions. Create room and Join room are the only setup entry points, for both one-device and multi-device play. All matches start from the lobby after player/rule selection and explicit Ready and Start match actions. There is no past-room list.
- Accounts can belong to only one room, including while watching or waiting between matches. Creating or joining another room requires leaving first. Play refreshes membership status without renewing its deadline. Deleting saved guests never releases an active match reservation.
- `/rooms`: redirects to Play. Default authentication destinations also lead to Play; safe explicit return destinations are preserved.
- `/match/new`: redirects to Play, preserving old links without a separate setup or automatic-start flow.
- `/room/[id]`: invite/copy and Leave controls, persistent connection and readiness information, member list with reconnect countdowns, roster selection, and saved rules. Creating a room without explicit rules uses the owner's saved X01 defaults. Explain the five-minute absence rule and room deletion. Owner edits remain explicit saves. Explain unsaved edits and disabled Ready/Start actions. Adding a guest still selects and saves it, as specified in 08. When a match starts, every client waiting in the lobby, including spectators, automatically opens its scoreboard. Late arrivals watch the running match and join the next one.
- `/match/[id]`: provide Leave room and explain absence consequences. After completion, Play again is the primary next action, including in the recap, and returns to the same lobby for readiness confirmation. Unavailable room/match links offer Play and History; finished results remain in History after room deletion.
- `/players`: player creation and name/color editing through dialogs, a mode switch for lifetime statistics, a desktop table, and phone rows with expandable details. Name and color updates use one existing player API transaction. The account player cannot be removed; historical snapshots are preserved.
- `/history`: compact results with expandable full statistics; use stacked statistics on phones. The empty state links to Play to create or return to a room. “Hide from my history” affects only the current account and its aggregate statistics.
- `/settings`: match defaults and audio preferences with one explicit save. Language/voice remain browser-local, with preview and speech feedback.
- Authentication pages: narrow forms, contextual links, visible success/error states, and existing CAPTCHA, verification, password-reset, and validation behavior.

Removal actions live in overflow menus and require confirmation: hiding history, removing saved guests or room members, clearing guests, and abandoning a match. Invite-code rotation also confirms that the old code will stop working.

Leave room is an explicit button with confirmation explaining unfinished-match abandonment, ownership transfer, and final-member room deletion as applicable. Ambiguous leave requests retain their original revision for explicit retry.
