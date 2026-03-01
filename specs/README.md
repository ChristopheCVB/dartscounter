# DartCounter Specs

This directory tracks the product/implementation specs for DartCounter as-built.

Last verified against code: 2026-03-01

Current baseline:

- Stack: Nuxt 4 + Nuxt UI + Pinia + TypeScript
- Package manager: Bun
- MVP game mode: X01 only (301/501)
- Audience: friends playing locally on one device
- Persistence: local-first (`localStorage`, with optional `idb` growth path)
- UI direction: sporty modern, Nuxt UI-first components/layout
- Platform priority: responsive for mobile and desktop
- Turn behavior: auto-end after 3 darts
- Keyboard shortcuts: Nuxt UI `defineShortcuts` on live match page

Reading order:

1. `specs/01-product-mvp.md`
2. `specs/02-architecture-and-data-model.md`
3. `specs/03-day1-bootstrap-and-engine.md`
4. `specs/04-day2-playable-loop.md`
5. `specs/05-day3-summary-history-settings.md`
6. `specs/06-keyboard-shortcuts-nuxt-ui.md`

Use these docs as source-of-truth for current behavior plus targeted follow-up work.
