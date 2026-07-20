# Phase 2 — Polish & Templates

> Make the herd pleasant: interactive widget, badge polish, templates/resume,
> noise control. None of this is needed to prove the concept.

**Status:** done · **Depends on:** Phase 1 · **Unblocks:** Phase 3

All items shipped. 66 tests pass, `tsc` clean. See `done.md` for the full
checklist.

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
  as a template to `.pi/herd-my-pi/templates/<name>.json`.
- `/herd-resume <name>` — re-instantiate a previously-saved template (note: pi
  session resume itself is pi's native `/resume`; herd resume = re-spawn the
  *agent shape*, optionally pointing at a saved session).

### Noise control (D11 follow-through)
- `/herd-hide <name>` — suppress a row from the roster (persists in state.json
  as a hidden set).
- `/herd-unhide <name>` — restore.
- Hidden rows tracked per-workspace.

### Worktree lifecycle (create landed in Phase 1; D22/D23/D25)
- `/herd-merge <name>` — wraps `wt merge` (squash + rebase + fast-forward +
  remove worktree, with pre-merge hooks as local CI). Resolve `<name>` →
  `herd-my-pi/<name>` branch + worktree path from state row; drive `wt merge` with
  `-y`/`--yes` to avoid interactive hook-approval blocking.
- `/herd-discard <name>` — wraps `wt remove` (removes worktree + branch).
- `⊕ N unmerged herd worktrees` badge on every widget, computed from
  `wt list --format json` filtered to `herd-my-pi/*` branches with changes or
  unpushed commits. Replaces herd-side dirty-checking — wt already detects it.
- Per-role `isolate: true` frontmatter warning: when a role expects isolation
  but the user spawned without `--isolate`, the child shows a `ctx.ui.notify`
  at spawn ("role expects isolation; running on shared tree") and a persistent
  `⚠` marker on that row in every widget.
- Default in `.pi/herd-my-pi/config.json`: `worktrees.autoDiscardOnClose = false`
  (never auto-delete; surface via the badge instead).

### `compact-for-*` refinements
- Iterate on the six templates based on real push/pull usage.
- Optional: per-template `description` + autocomplete hints polish.
- Consider a shared `_handoff-skeleton.md` partial if pi prompt templates
  support includes (if not, keep them standalone).

## Out of scope (Phase 3)
- Cooperative agent-side pull tool (an agent requests a peer's context via a
  tool, no central orchestrator).
- Optional lead-agent mode.
- Cross-workspace `--all` roster view.

## Risks / open impl details
- ~~Focusing another pane via herdr: confirm the exact `herdr` focus/switch
  subcommand (`pane focus`? `tab select`?) — differs for pane vs tab.~~ →
  **Resolved:** herdr 0.7.4 has no named-pane focus, only `tab focus <tabId>`
  and directional `pane focus --direction`. `/herd-focus` uses `tab focus`.
  If herdr adds `pane focus <paneId>` later, it's a one-line change.
- Template format vs role-agent format: a herd template is *not* a pi agent
  definition — it's the spawn-time choices (role + model + thinking + goal +
  type). Keep it as a small JSON in `.pi/herd-my-pi/templates/`.
