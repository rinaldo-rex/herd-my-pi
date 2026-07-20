# Phase 2 — Todo

Polish & templates. Track progress here.

## Interactive widget (selectable rows → focus)
- [x] `ctx.ui.custom()` overlay (SelectList + DynamicBorder) on demand
- [x] `↑/↓` navigate, `Enter` focus target pane, `Esc` back to display-only
- [x] Focus via herdr `tab focus` subcommand
- [x] Reuse Phase-1 roster data/render

## Badge & widget polish
- [x] Thinking badge on rows
- [x] Row detail/expand (model id, working-tree summary, session path, role, goal)
- [x] `--stale-first` sort inversion (`/herd-stale` command)
- [x] Pulse-vs-dim tuning from config

## Templates & resume
- [x] `/herd-new --template <name>` spawn from saved template
- [x] `/herd-save <name>` write `.pi/herd-my-pi/templates/<name>.json`
- [x] `/herd-resume <name>` re-instantiate agent shape
- [x] Template format (role+model+thinking+goal+type), not a pi agent definition

## Noise control
- [x] `/herd-hide <name>` (persist hidden set in state.json, per-workspace)
- [x] `/herd-unhide <name>`

## Worktree lifecycle (create landed in Phase 1)
- [x] `/herd-merge <name>` wraps `wt merge`
- [x] `/herd-discard <name>` wraps `wt remove`
- [x] `⊕ N unmerged herd worktrees` badge from `wt list --format json`
- [x] Per-role `isolate: true` warning: notify on spawn + persistent `⚠` row marker
- [x] Config default `worktrees.autoDiscardOnClose = false`

## `compact-for-*` refinements
- [x] Iterate the 6 templates from real usage
- [x] Per-template description + autocomplete hints
- [x] Shared skeleton partial — deferred (pi prompt templates don't support includes; keep standalone)
