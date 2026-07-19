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

## `compact-for-*` refinements
- [ ] Iterate the 5 templates from real usage
- [ ] Per-template description + autocomplete hints
- [ ] Shared skeleton partial if prompt templates support includes
