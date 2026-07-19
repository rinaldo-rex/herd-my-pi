# Phase 1 — Todo

The closed herd loop. Track progress here.

## `/herd` — toggle + display-only widget
- [ ] `pi.registerCommand("herd", ...)` toggle (in-memory visibility)
- [ ] Startup: show widget if `HERDR_HERD_WIDGET=1`
- [ ] `ctx.ui.setWidget("herd", lines, { placement: "aboveEditor" })` render path
- [ ] Refresh timer (default ~1s, configurable) → `readRoster(myWorkspaceId)`
- [ ] Current-pane pin via `readCurrentPaneId()` → `▶`
- [ ] `★`-main row via `HERDR_HERD_MAIN_PANE`
- [ ] Row format: `▶? ★? ◆|◇ name  model  wt-state  elapsed`
- [ ] Elapsed color thresholds (green/amber/red) + pulse >30m
- [ ] Sort: current pinned, then lastActivityMs desc (stale sinks)
- [ ] Closed-pane transient "X exited" + drop after configurable duration
- [ ] Clear widget on session end

## `/herd-init` — scaffold
- [ ] `pi.registerCommand("herd-init", ...)`; `--force` flag
- [ ] Idempotent merge into `.pi/prompts/`, `.pi/agents/`, `.pi/herd/config.json`
- [ ] Never overwrite existing user files unless `--force`
- [ ] Create `.pi/herd/` dir + config.json from package defaults
- [ ] Materialize 5 templates + 4 role agents (only if missing)

## `/herd-new` — spawn agent
- [ ] `pi.registerCommand("herd-new", ...)`; arg `<name>`
- [ ] Named: `createSplit` (default pane) → start pi with env (`HERDR_HERD_MAIN_PANE`, `HERDR_HERD_WIDGET=1`) + chosen `--model`/`--thinking`/`--name`
- [ ] No-arg: `ctx.ui.custom()` widget (name, type, role, model, thinking, goal)
- [ ] Role discovery from `.pi/agents/`
- [ ] Model dropdown from pi's available models in-process
- [ ] Type=tab path via `createTab`
- [ ] Name collision → error by default (configurable auto-suffix)
- [ ] Ready-delay knob reuse (PI_SUBAGENT_SHELL_READY_DELAY_MS-style)
- [ ] Write child's initial state row; auto-enable my widget
- [ ] `--isolate` flag → run `wt switch -c -x "pi …" herd/<name>` in the new pane
- [ ] Detect `wt` availability; error clearly if `--isolate` used without `wt`
- [ ] Spawned agent writes worktree `branch` + `worktreePath` into its state row

## `/herd-push` + `/herd-receive` (inbound)
- [ ] `pi.registerCommand("herd-push", ...)`; arg `<name>`; flag `--force`
- [ ] Read my own last assistant message in-process
- [ ] `ctx.ui.custom()` editor pre-filled (editable)
- [ ] base64-encode `{ message, from }`; resolve name→paneId from roster
- [ ] Busy target: queue by default; `--force` → `sendEscape` then push
- [ ] Deliver via `sendCommand(target, "/herd-receive <base64>")`
- [ ] `pi.registerCommand("herd-receive", ...)` (internal): decode + inject as next prompt via extension API
- [ ] Keep `/herd-receive` off autocomplete palette if possible

## `/herd-pull` + `/herd-emit-last` (inbound)
- [ ] `pi.registerCommand("herd-pull", ...)`; arg `<name>`; flag `--edit`
- [ ] Resolve name→paneId; `sendCommand(target, "/herd-emit-last --to <myPaneId>")`
- [ ] `pi.registerCommand("herd-emit-last", ...)` (internal): read own last assistant msg, base64, `sendCommand(myPaneId, "/herd-receive <base64>")`
- [ ] Default receipt → `ctx.ui.setEditorText(text)` (direct inject)
- [ ] `--edit` → open pre-filled `ctx.ui.custom()` editor

## Bundled resources
- [ ] `prompts/compact-for-exploration.md` (arg-hint, artifact refs, secrets)
- [ ] `prompts/compact-for-debug.md`
- [ ] `prompts/compact-for-prototype.md`
- [ ] `prompts/compact-for-review.md`
- [ ] `prompts/compact-for-handoff.md`
- [ ] `prompts/compact-for-variants.md` (parallel-prototype spawn-plan template)
- [ ] `agents/explorer.md` (model+thinking frontmatter)
- [ ] `agents/debugger.md`
- [ ] `agents/prototyper.md`
- [ ] `agents/reviewer.md`

## Validation / integration
- [ ] End-to-end: `/herd-init` → `/herd-new scout` → widget shows scout → `/herd-push scout` → scout receives → `/herd-pull scout` → orchestrator receives
- [ ] End-to-end isolated: `/herd-new --isolate proto` → wt worktree created on `herd/proto` → roster shows branch → pane runs pi in the worktree
- [ ] Verify base64 survives `pane run` (multiline/special chars)
- [ ] Verify `/herd-receive` executes in target even if target is streaming
- [ ] Verify ★-main marker + current-pane ▶ highlight move on focus change
- [ ] Verify closed-pane transient + drop
