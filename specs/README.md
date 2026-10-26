# DartsCounter Specs

This directory tracks the product/implementation specs for DartsCounter as-built.

Last verified against code: 2026-10-26

Current behavior is defined by [08-server-multiplayer.md](08-server-multiplayer.md), which supersedes local-only persistence and authentication requirements below.

Classic Cricket rules and integration are defined by [10-cricket.md](10-cricket.md).

Navigation and page layouts are defined by [09-ui-navigation.md](09-ui-navigation.md).

Previous baseline:

- Stack: Nuxt 4 + Nuxt UI + Pinia + TypeScript
- Package manager: Bun
- MVP game mode: X01 only (301/501)
- Audience: friends playing locally on one device
- Persistence: local-first (`localStorage`)
- UI direction: sporty modern, Nuxt UI-first components/layout
- Platform priority: responsive for mobile and desktop
- Turn behavior: auto-end after 3 darts
- Keyboard shortcuts: Nuxt UI `defineShortcuts` on live match page

Reading order (read specification 08 first for server/auth/room behavior):

1. `specs/01-product-mvp.md`
2. `specs/02-architecture-and-data-model.md`
3. `specs/03-bootstrap-and-engine.md`
4. `specs/04-playable-loop.md`
5. `specs/05-summary-history-settings.md`
6. `specs/06-keyboard-shortcuts-nuxt-ui.md`
7. `specs/07-recent-players-and-lifetime-stats.md`
8. `specs/08-server-multiplayer.md`
9. `specs/09-ui-navigation.md`
10. `specs/10-cricket.md`

Use these docs as source-of-truth for current behavior plus targeted follow-up work.
