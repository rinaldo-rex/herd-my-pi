# Phase 1 — Todo

The closed herd loop. Track progress here.

## `/herd` — toggle + display-only widget
- [x] `pi.registerCommand("herd", ...)` toggle (in-memory visibility)
- [x] Startup: show widget if `HERDR_HERD_WIDGET=1`
- [x] `ctx.ui.setWidget("herd", lines, { placement: "aboveEditor" })` render path
- [x] Refresh timer (default ~1s, configurable) → `readRoster(myWorkspaceId)`
- [x] Current-pane pin via `readCurrentPaneId()` → `▶`
- [x] `★`-main row via `HERDR_HERD_MAIN_PANE`
- [x] Row format: `▶? ★? ◆|◇ name  model  wt-state  elapsed`
- [x] Elapsed color thresholds (green/amber/red) + pulse >30m
- [x] Sort: current pinned, then lastActivityMs desc (stale sinks)
- [x] Closed-pane transient "X exited" + drop after configurable duration
- [x] Clear widget on session end

## `/herd-init` — scaffold
- [x] `pi.registerCommand("herd-init", ...)`; `--force` flag
- [x] Idempotent merge into `.pi/prompts/`, `.pi/agents/`, `.pi/herd-my-pi/config.json`
- [x] Never overwrite existing user files unless `--force`
- [x] Create `.pi/herd-my-pi/` dir + config.json from package defaults
- [x] Materialize 6 templates + 4 role agents (only if missing)

## `/herd-new` — spawn agent
- [x] `pi.registerCommand("herd-new", ...)`; arg `<name>`
- [x] Named: `createSplit` (default pane) → start pi with env (`HERDR_HERD_MAIN_PANE`, `HERDR_HERD_WIDGET=1`) + chosen `--model`/`--thinking`/`--name`
- [x] No-arg: sequential input flow (name, type, role, model, thinking, goal)
- [x] Role discovery from `.pi/agents/`
- [x] Name collision → error by default (configurable auto-suffix)
- [x] Ready-delay knob reuse (PI_SUBAGENT_SHELL_READY_DELAY_MS-style)
- [x] Write child's initial state row; auto-enable my widget
- [x] `--isolate` flag → run `wt switch -c -x "pi …" herd-my-pi/<name>` in the new pane
- [x] Detect `wt` availability; error clearly if `--isolate` used without `wt`
- [x] Spawned agent writes worktree `branch` + `worktreePath` into its state row

## `/herd-push` + `/herd-receive` (inbound)
- [x] `pi.registerCommand("herd-push", ...)`; arg `<name>`; flag `--force`
- [x] Read my own last assistant message in-process
- [x] `ctx.ui.editor()` pre-filled (editable)
- [x] base64-encode `{ message, from }`; resolve name→paneId from roster
- [x] Busy target: queue by default; `--force` → `sendEscape` then push
- [x] Deliver via `sendCommand(target, "/herd-receive <base64>")`
- [x] `pi.registerCommand("herd-receive", ...)` (internal): decode + inject as next prompt via extension API

## `/herd-pull` + `/herd-emit-last` (inbound)
- [x] `pi.registerCommand("herd-pull", ...)`; arg `<name>`; flag `--edit`
- [x] Resolve name→paneId; `sendCommand(target, "/herd-emit-last --to <myPaneId>")`
- [x] `pi.registerCommand("herd-emit-last", ...)` (internal): read own last assistant msg, base64, `sendCommand(myPaneId, "/herd-receive <base64>")`
- [x] Default receipt → `ctx.ui.setEditorText(text)` (direct inject)
- [x] `--edit` → open pre-filled `ctx.ui.editor()`

## Bundled resources
- [x] `prompts/compact-for-exploration.md` (arg-hint, artifact refs, secrets)
- [x] `prompts/compact-for-debug.md`
- [x] `prompts/compact-for-prototype.md`
- [x] `prompts/compact-for-review.md`
- [x] `prompts/compact-for-handoff.md`
- [x] `prompts/compact-for-variants.md` (parallel-prototype spawn-plan template)
- [x] `agents/explorer.md` (model+thinking frontmatter)
- [x] `agents/debugger.md`
- [x] `agents/prototyper.md`
- [x] `agents/reviewer.md`

## Validation / integration
- [x] End-to-end: `/herd-init` → `/herd-new scout` → widget shows scout → `/herd-push scout` → scout receives → `/herd-pull scout` → orchestrator receives
- [x] End-to-end isolated: `/herd-new --isolate proto` → wt worktree created on `herd-my-pi/proto` → roster shows branch → pane runs pi in the worktree
- [x] Verify base64 survives `pane run` (multiline/special chars)
- [x] Verify `/herd-receive` executes in target even if target is streaming
- [x] Verify ★-main marker + current-pane ▶ highlight move on focus change
- [x] Verify closed-pane transient + drop
