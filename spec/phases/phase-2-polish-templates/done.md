# Phase 2 — Done

All items completed. No specific commit/PR refs yet — all landed together.

- [x] Interactive widget — `/herd-focus` overlay with SelectList, arrow-nav, Enter-to-focus, Esc-to-dismiss
- [x] Thinking badge — compact `🧠H`/`🧠L`/`🧠M`/`🧠X` badges on rows
- [x] Row detail — cycling widget modes (compact → detail → detailAll) with model/thinking/role/goal/wt/session sub-lines
- [x] `--stale-first` / `/herd-stale` — toggle sort inversion from keyboard
- [x] Pulse-vs-dim config — `staleness.pulseStyle` respected in `colorElapsed`
- [x] `/herd-new --template <name>` — spawn from saved template
- [x] `/herd-save <name>` — persist current agent shape to `.pi/herd-my-pi/templates/<name>.json`
- [x] `/herd-resume <name>` — re-instantiate from a saved template
- [x] Template format — role + model + thinking + goal + type (NOT a pi agent definition)
- [x] `/herd-hide <name>` — suppress row (persists in state.json)
- [x] `/herd-unhide <name>` — restore row
- [x] Hidden set stored per-workspace in state.json (via paneId set)
- [x] `/herd-merge <name>` — wraps `wt merge` with `-y` for non-interactive
- [x] `/herd-discard <name>` — wraps `wt remove`
- [x] `⊕ N unmerged herd worktrees` badge — computed from `wt list --format json`
- [x] Per-role `isolate: true` warning — notify on spawn + persistent `⚠` row marker
- [x] `config.worktrees.autoDiscardOnClose = false` default
- [x] `compact-for-*` refinements — all 6 templates have `autocomplete-hint` + improved descriptions
- [x] `exploration.md` template: added "always include a verdict" clause
- [x] `PaneRow` extended: `role`, `goal`, `warnings` fields for Phase 2
- [x] `RosterRow` extended: passes through role/goal/warnings
- [x] `Config` extended: `hidden.paneIds` for noise control
- [x] `state.ts` extended: `hidePane`, `unhidePane`, `getHiddenPaneIds`, `listTemplates`, `loadTemplate`, `saveTemplate`, `templatesDir`
- [x] `readRoster` filters hidden panes
- [x] `herdr.ts` extended: `isWtAvailable`, `wtMerge`, `wtRemove`, `wtList`, `countUnmergedHerdWorktrees`
- [x] Widget: `⚠` warning badge on rows, unmerged worktree count in header
- [x] `config.json` + `config.ts` updated with `hidden` key
- [x] 66 tests pass, `tsc --noEmit` clean
