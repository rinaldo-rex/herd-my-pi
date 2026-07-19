# Phase 2 — Done

Merged as squash `3e69afa` on `main`.

## Interactive widget (selectable rows → focus)
- [x] `/herd-focus` command — SelectList overlay (`ctx.ui.custom({ overlay: true })`)
  built from same roster data as the display widget.
- [x] `↑/↓` navigate, `Enter` focuses target pane via `herdr tab focus <tabId>`,
  `Esc` dismisses. herdr 0.7.4 has no named-pane focus — tab focus is the best
  available surface. If herdr adds `pane focus <paneId>`, it's a one-line change.
- [x] Roster JOIN updated to propagate `tabId` from `HerdrPane` into `RosterRow`.
- [x] Added `focusTab()` and `listTabs()` and `getWorkspaceLabel()` to
  `src/herdr.ts`.
- [x] Reuses Phase-1 widget utilities: `sortRows`, `formatElapsed`, `elapsedTier`.
- [x] Wired into `extensions/index.ts`.
- [x] 44 tests pass, `tsc --noEmit` clean.

## Named roster rows (displayName helper)
- [x] `displayName(row)` heuristic: state.json name → herdr tab label → terminal
  title → raw paneId. Tab labels resolved via `herdr tab list` JOIN.
- [x] Widget title bar now shows the herdr workspace label (`herdr workspace
  list`), not a hardcoded "Herd".
- [x] `RosterRow` gains `tabId`, `tabLabel`, `terminalTitle` fields.
- [x] `formatClosedRow` signature simplified (removed unused `config` param).

Files changed/added:
- `extensions/herd-focus.ts` (new)
- `extensions/index.ts` (+registerHerdFocus)
- `extensions/herd.ts` (workspace label title, simplified formatClosedRow)
- `extensions/widget.ts` (+displayName helper, renderEmptyBox title param)
- `src/herdr.ts` (+focusTab, +listTabs, +getWorkspaceLabel)
- `src/state.ts` (+tabLabels JOIN, +tabId/terminalTitle/tabLabel in joinPane)
- `src/types.ts` (+tabId, +terminalTitle, +tabLabel on RosterRow)
- `tests/widget.test.ts` (formatClosedRow signature fix)
- `tsconfig.json` (paths mapping for @earendil-works/pi-tui transitively)

Remaining Phase 2 items: see [todo.md](./todo.md).
