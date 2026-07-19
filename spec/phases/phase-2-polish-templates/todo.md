# Phase 2 — Todo

Polish & templates. Track progress here.

## Interactive widget (selectable rows → focus)
- [ ] `ctx.ui.custom()` overlay (SelectList + DynamicBorder) on demand
- [ ] `↑/↓` navigate, `Enter` focus target pane, `Esc` back to display-only
- [ ] Focus via herdr (confirm subcommand for pane vs tab)
- [ ] Reuse Phase-1 roster data/render

## Badge & widget polish
- [ ] Thinking badge on rows
- [ ] Row detail/expand (model id, working-tree summary, session path)
- [ ] `--stale-first` sort inversion (flag or config key)
- [ ] Pulse-vs-dim tuning from config

## Templates & resume
- [ ] `/herd-new --template <name>` spawn from saved template
- [ ] `/herd-save <name>` write `.pi/herd/templates/<name>.json`
- [ ] `/herd-resume <name>` re-instantiate agent shape
- [ ] Template format (role+model+thinking+goal+type), not a pi agent definition

## Noise control
- [ ] `/herd-hide <name>` (persist hidden set in state.json, per-workspace)
- [ ] `/herd-unhide <name>`

## Worktree lifecycle (create landed in Phase 1)
- [ ] `/herd-merge <name>` wraps `wt merge` (name→herd/<name> resolution, `-y` for hooks)
- [ ] `/herd-discard <name>` wraps `wt remove`
- [ ] `⊕ N unmerged herd worktrees` badge from `wt list --format json` (filter herd/* with changes/unpushed)
- [ ] Per-role `isolate: true` warning: notify on spawn + persistent `⚠` row marker
- [ ] Config default `worktrees.autoDiscardOnClose = false`

## `compact-for-*` refinements
- [ ] Iterate the 6 templates from real usage
- [ ] Per-template description + autocomplete hints
- [ ] Shared skeleton partial if prompt templates support includes
