# Keyboard Shortcuts Spec (Nuxt UI defineShortcuts)

## Status

Implemented baseline with minor hardening follow-ups.
Last verified against code: 2026-03-01

## Scope

- Use Nuxt UI `defineShortcuts` only.
- Apply shortcuts only on live match page (`app/pages/match/[id].vue`).
- Target keyboard users on desktop/tablet.

## Decisions

- Auto-end turns remain enabled after 3 darts.
- Include both input styles:
  - numeric total entry (`0-9` then `Enter`)
  - board-style shortcuts (multiplier + segment actions)

## Shortcut Map

- `s`: set single multiplier
- `d`: set double multiplier
- `t`: set treble multiplier
- `b`: bull 25
- `shift+b`: bull 50
- `m`: miss 0
- `u`: undo last dart
- `0-9`: append numeric input buffer
- `backspace`: remove last numeric digit
- `enter`: submit numeric input
- `?`: toggle shortcuts help
- `escape`: close help or clear numeric buffer

## Guard Rules

For non-modal actions, require all:

- active match exists
- no text/number/textarea/contenteditable focus
- no blocking modal open
- not in auto-end transition lock

Current implementation uses state/UI guards above. A dedicated modifier-key guard (`metaKey`/`ctrlKey`/`altKey`) is a potential hardening follow-up.

## Numeric Buffer Rules

- max accepted value: 60
- values above 60 are ignored by numeric buffer logic
- clear buffer after successful submit
- clear buffer after bust/checkout/turn transition

## Help UX

- `?` toggles a modal listing keymap.
- `Esc` closes modal.
- If modal is closed, `Esc` clears pending numeric input.

## Validation Checklist

- full turn can be played without mouse
- undo works around turn boundaries
- no shortcuts fire while editing text inputs
- transition lock prevents accidental extra inputs
- browser/system shortcuts remain unaffected
