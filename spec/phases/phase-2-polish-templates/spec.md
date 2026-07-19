# Phase 2 — Polish & Templates

> Make the herd pleasant: interactive widget, badge polish, templates/resume,
> noise control. None of this is needed to prove the concept.

**Status:** not started · **Depends on:** Phase 1 · **Unblocks:** Phase 3

## Scope

### Interactive widget (selectable rows → focus a pane)
- `ctx.ui.custom()` overlay (tui.md Pattern 1 `SelectList` + `DynamicBorder`)
  replacing the string-array widget on demand.
- `↑/↓` navigate rows, `Enter` focuses the target pane (via `herdr`'s
  focus/switch surface), `Esc` returns to display-only.
- Reuses the same roster data + render as Phase 1; selection is an overlay layer.
- The highest-leverage UX add: a monitor becomes a switcher.

### Badge & widget polish
- Thinking badge on rows (recoverable from state row; was dropped in v1).
- Row detail/tooltip (Ctrl+O-style expand) for full model id, working-tree
  summary, session file path.
- `--stale-first` flag (or config key) to invert sort — "what have I neglected."
- Pulse-vs-dim tuning from config.

### Templates & resume (ephemeral-but-templates model, D2)
- `/herd-new --template <name>` — spawn from a saved template on disk.
- `/herd-save <name>` — save the current pane's (model + thinking + role + goal)
  as a template to `.pi/herd/templates/<name>.json`.
- `/herd-resume <name>` — re-instantiate a previously-saved template (note: pi
  session resume itself is pi's native `/resume`; herd resume = re-spawn the
  *agent shape*, optionally pointing at a saved session).

### Noise control (D11 follow-through)
- `/herd-hide <name>` — suppress a row from the roster (persists in state.json
  as a hidden set).
- `/herd-unhide <name>` — restore.
- Hidden rows tracked per-workspace.

### `compact-for-*` refinements
- Iterate on the five templates based on real push/pull usage.
- Optional: per-template `description` + autocomplete hints polish.
- Consider a shared `_handoff-skeleton.md` partial if pi prompt templates
  support includes (if not, keep them standalone).

## Out of scope (Phase 3)
- Cooperative agent-side pull tool (an agent requests a peer's context via a
  tool, no central orchestrator).
- Optional lead-agent mode.
- Cross-workspace `--all` roster view.
- Per-agent working-tree isolation flags.

## Risks / open impl details
- Focusing another pane via herdr: confirm the exact `herdr` focus/switch
  subcommand (`pane focus`? `tab select`?) — differs for pane vs tab.
- Template format vs role-agent format: a herd template is *not* a pi agent
  definition — it's the spawn-time choices (role + model + thinking + goal +
  type). Keep it as a small JSON in `.pi/herd/templates/`.
