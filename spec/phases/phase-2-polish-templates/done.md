# Phase 2 — Done

Nothing yet. Move items here as they're completed (with commit/PR ref).

## Interactive widget (selectable rows → focus)
- [x] `/herd-focus` command — SelectList overlay built from same roster data as the display widget
- [x] `↑/↓` navigate, `Enter` focuses target pane via `herdr tab focus <tabId>`, `Esc` dismisses
- [x] Roster JOIN updated to propagate `tabId` from `HerdrPane` into `RosterRow`
- [x] Added `focusTab()` to `src/herdr.ts` (`herdr tab focus <tabId>`)
- [x] Reuses Phase-1 widget utilities: `sortRows`, `formatElapsed`, `elapsedTier`
- [x] Wired into `extensions/index.ts`
- [x] 44 tests pass, `tsc --noEmit` clean

Files changed/added:
- `extensions/herd-focus.ts` (new)
- `extensions/index.ts` (register `/herd-focus`)
- `src/herdr.ts` (+`focusTab`)
- `src/state.ts` (+`tabId` in `joinPane`)
- `src/types.ts` (+`tabId` on `RosterRow`)

- [ ] *(empty)*
