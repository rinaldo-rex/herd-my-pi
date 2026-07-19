# Brainstorm v1 — herd-my-pi

This is the living record of the brainstorm that produced
[philosophy.md](./philosophy.md), [design_decisions.md](./design_decisions.md),
and [spec/phases/](./spec/phases/). It was written before any code; **Phase 0
and Phase 1 are now implemented** (see `src/`, `extensions/`, and the
per-phase `done.md`). This document captures only the scope and rationale —
it is not updated as code lands.

## The starting idea

A simple pi Package to orchestrate **multi-agent** workflow — explicitly
*different* from a typical sub-agent workflow. Reference project for
inspiration: https://github.com/0xRichardH/pi-herdr-subagents

Differentiation stated up front (point #2 of the original brief):

> I should be able to modify any agent from within their agent shell (model,
> thinking effort) and that should reflect in this widget. Unlike other
> sub-agent workflows where you can't hop in and control the sub-agent's
> context, model, or what it should be doing — this is the primary difference
> with my multi-agent workflow vs the common sub-agent workflow.

Original command sketch:
- A small UI widget above the footer (toggle with `/herd`), showing all
  available agents from the current herdr session (tab/pane names).
- `/herd-push "agent-name"` — opens a widget with an input for "what to push"
  and default fields for model + thinking effort (dynamically fetched from pi's
  model list).
- `/herd-pull "agent-name"` — opposite of push; fetch the target's last
  agent message/summary into the current agent's next input.
- `/herd-new "agent-name"` — create a new agent in a side pane by default; with
  no name, open a widget with name / type (pane|tab) / model / thinking effort /
  core context to append to the system prompt.

## Research findings

### The reference project (`pi-herdr-subagents`) is the *opposite* philosophy

Async, fire-and-forget: `subagent()` returns immediately, the sub-agent runs in
its own pane, a widget projects state (`starting/active/waiting/stalled/...`),
and the result is *steered back* into the parent as a notification. The parent
never touches the child's context, model, or thinking. That's the canonical
sub-agent workflow this package reacts against. Key reuse: `herdr.ts` exposes
`createHerdrSurface` (tab), `createHerdrSurfaceSplit` (pane), `sendHerdrCommand`
(`pane run`), `readHerdrScreen`, `inspectHerdrPane` — all reusable.

### What users actually hate about sub-agent workflows (dibi8 postmortem)

Five failure modes, all sharing one root — **treating an agent's claim as
verified reality**:
1. **Trust trap** — orchestrator ships on a sub-agent's prose summary ("tests
   pass") that was a belief, not a verified run.
2. **Context bleed** — parallel agents writing the same working tree → garbled
   half-merges.
3. **Runaway fan-out** — `subagent` inside a loop with no stop condition → 10×
   cost or a pipeline that never converges.
4. **Silent truncation** — finder capped at top-N and nobody logged it; "audit
   complete" was 60% coverage.
5. **Orphaned worktree** — a later agent reads a half-finished tree as canonical.

Meta-frustration: **you cannot intervene.** Once `subagent()` returns, the child
is a black box. Every fix in the postmortem is a *prompt-discipline* band-aid;
none give you the wheel back.

### The handoff prompt pattern is an established genre

`mattpocock/skills` handoff, `iTofu/handoff-skills`, `0xBigBoss` handoff
command — the canonical pattern is "compact the current conversation into a
handoff document for another agent to pick up," argument-driven, that
**references artifacts by path (doesn't duplicate)** and **redacts secrets**.
herd-my-pi's `compact-for-*` templates are purpose-specialized handoffs.

### pi docs that resolved the technical unknowns

- `rpc.md`: RPC mode is headless JSON-over-stdio; only works when a pane runs
  `pi --mode rpc` (non-interactive). Interactive TUI panes expose no RPC socket.
  RPC commands `set_model`, `set_thinking_level`, `get_last_assistant_text`,
  `get_available_models`, `steer`, `follow_up`, `abort` exist — but only apply
  to headless sessions. Confirmed RPC is wrong for the herd (interactive panes).
- `tui.md`: `ctx.ui.setWidget("herd", lines)` renders above the editor (Pattern
  5); `ctx.ui.custom()` overlay + `SelectList` (Pattern 1) for Phase-2 focus;
  `theme.fg()`/`theme.bg()` for color; `matchesKey`/`Key` for input.
- `sessions.md`: pi sessions are JSONL trees; `/tree`, `/fork`, `/clone`,
  `/resume`, `/model` are built-in interactive commands — covering the "rerun a
  flow" / "change model in-pane" needs natively.
- `models.md`: model catalog + `thinkingLevelMap`; per-model thinking levels.
- `settings.md` + `packages.md` + `prompt-templates.md`: `.pi/` is the
  project-local root (NOT `.pi/agent/`, which is global). `.pi/prompts/*.md` and
  `.pi/agents/*.md` are auto-discovered; project > global > bundled precedence.
- `extensions.md` (inferred from reference + tui.md): extensions register
  commands via `pi.registerCommand()`; extension commands invoked via `/name`
  even during streaming; `pi.sendMessage()` lets an extension command inject a
  prompt into its own agent.

## The control-axis flip (the reframing)

herd-my-pi flips the control axis from
**agent-orchestrates-agents-fire-and-forget** to
**human-is-the-orchestrator, agents-are-persistent-interactive-shells-you-hop-between**.
Closer to "tmux for agents" than "subagent fan-out." This dissolves the
postmortem's five failures *by construction* (see philosophy.md).

## The rounds (questions → answers → refinements)

### Round 1 — foundational scope
- **Who drives?** → Human only. Automation deferred to Phase 3.
- **Agent lifetime?** → Ephemeral at runtime, but templates saveable;
  `/herd-resume` future.
- **Push payload?** → My last assistant message (pre-filled, editable) + optional
  model + optional thinking. *(Later refined — see D6.)*
- **Pull source?** → Target's last assistant message → my next input; default
  direct inject, `--edit` opens widget.

### Round 2 — widget, badges, templates, phases
- **Widget v1?** → Display-only, but highlights the currently-focused pane/tab;
  `/herd-new` auto-enables the widget toggle in the child.
- **Row badges?** → Name + model + working-tree state + elapsed/last-activity.
  Thinking dropped. *Question raised: how to surface stagnation without
  crowding?* → Answered in Round 4 (D8).
- **Compact templates to ship?** → The four named + the umbrella handoff
  (research-sourced). Ship in v1.
- **Phase plan?** → Pull templates into v1. Add `/herd-init` to scaffold
  `.pi/`-local templates, role agents, and config — fully customizable.

### Round 3 — tabs/panes, topology, glyph
- **Tabs vs panes?** → Both supported; default **pane** (co-pilot, side-by-side);
  tabs for parked background agents. Reveals the herd is a **peer mesh**, not
  parent/child — every pi instance in the workspace runs the extension, shows
  the same roster, can herd any peer.
- **Topology?** → Philosophically peer mesh; for semantics, name a "main/
  orchestrator" (★, "where we started") via `HERDR_HERD_MAIN_PANE` env.
- **Surface glyph?** → ◆ (tab) / ◇ (pane) default, configurable; T/P preset
  shipped.

### Round 4 — workspace scope, staleness, ship roles, config home
- **Staleness UI?** → Color-thresholded elapsed + pin current + stale sinks;
  pulse for worst tier (>30m), color-only for middle.
- **Ship role agents?** → Yes, both templates AND role agent definitions.
- **Config home?** → `.pi/herd-my-pi/config.json` (dedicated), scaffolded by
  `/herd-init`, layered over package defaults.
- **Phase plan?** → Ratified (templates now in v1); `/herd-init` added.

### Round 5 — glyph pair + workspace scope confirm
- Glyph = ◆/◇ (filled/hollow diamond), configurable.
- Workspace scope = orchestrator's workspace only by default; ★-main; hide +
  cross-workspace `--all` deferred.
- *Note:* package name is **herd-my-pi** ("herd" as a verb, guiding my pi
  agents), herdr-exclusive. Internalized.

### Round 6 — the 8 open questions
After reading rpc/sessions/models/tui docs, nearly all technical unknowns
resolved. Eight genuinely-open product questions surfaced; user addressed all:

1. **Busy-target push** → queue by default, `--force` interrupts (Esc) then pushes.
2. **`/herd-new` fields** → role + goal (two scoped fields). *(Elaborated: role
   is the persona unit from `.pi/agents/`; compact templates belong to push
   flow. Having both role + free-text is only confusing if mashed into one
   field; as two scoped fields they compose.)*
3. **Pulse vs dim** → pulse for worst tier.
4. **Name collisions** → default error, configurable to auto-suffix.
5. **Closed-pane UX** → transient "X exited" then drop; duration configurable.
6. **Override semantics** → *refined away* (D6): `--model`/`--once` are
   superfluous. Model/thinking chosen at `/herd-new` (persist); changed mid-run
   via pi's native `/model` in-pane; `/tree` reruns flows. `/herd-push` carries
   no model — simplifies push to a single editable message field.
7. **Architecture** → ratified (after elaboration + RPC-vs-state.json
   justification): cooperative extension instances + base64 extension commands
   over `herdr pane run` + shared `.pi/herd-my-pi/state.json` + ★-main via env.
8. **`/herd-init` safety** → idempotent + merge, `--force` to reset.

## The final model (consolidated)

- **Topology:** peer mesh of pi instances in one herdr workspace; ★-marks the
  orchestrator pane (where the herd started), tracked via env.
- **Transport:** `herdr pane run <paneId> "/herd-receive <base64>"` — base64
  extension commands typed into a target's pi input.
- **Widget state:** shared `.pi/herd-my-pi/state.json`; each instance writes its own
  row (model, thinking, last-activity, cwd, working-tree, paneId, name,
  is-main); widget reads on a timer; "current" via `herdr pane current`.
- **Commands (Phase 1):** `/herd` (toggle display-only widget), `/herd-init`
  (scaffold), `/herd-new`, `/herd-push`, `/herd-pull`.
- **Push/pull:** mirror images — ferry the source pane's last assistant message
  into the target's input (pre-filled, editable via `--edit` on pull; push
  widget editable by default). Busy target: queue, or `--force` to interrupt.
- **Model/thinking:** a `/herd-new` concern (dropdown, persists); changed
  mid-run via pi's native `/model`; reflected in widget via state.json. Push
  carries no model.
- **Compaction:** five `compact-for-*` prompt templates run on the source
  before push; bundled + scaffolded editable.
- **Roles:** default agent definitions (`explorer/debugger/prototyper/reviewer`)
  bundled + scaffolded editable.
- **Roster badges:** ◆/◇ glyph + name + model + working-tree + elapsed
  (color-coded; pulse worst tier; pin current; stale sinks).
- **Scope:** orchestrator's workspace only; hide/unhide (Phase 2); `--all`
  cross-workspace (Phase 3).
- **Config:** `.pi/herd-my-pi/config.json` (dedicated), layered over package
  defaults; idempotent merge `/herd-init`, `--force` reset.
- **Name collisions:** error by default, configurable auto-suffix.
- **Closed pane:** transient "X exited" then drop.

## Round 7 — worktrees for prototyping (refinement)

A gap surfaced after the v1 docs were written: worktree utilization — especially
for **prototyping** — was never considered. The `compact-for-prototype` template
already implies parallel prototyping, and parallel prototyping on a shared tree
is *exactly* postmortem failure #2 (context bleed). Worktrees are the structural
fix; the postmortem's failure #5 (orphaned worktree) is the lifecycle trap. So
worktrees come as a pair: **create-isolated** *and* **reconcile-or-discard**.

Research: [Worktrunk](https://worktrunk.dev/) (`wt`) is a CLI for git worktree
management *designed for parallel AI agents* — a near-perfect fit. Key findings:
- `wt switch -c -x "<cmd>" <branch>` creates a worktree and launches a command
  inside it in one shot → `/herd-new --isolate` becomes a single `wt` call.
- `worktree-path` is a configurable template (user config or per-project via
  `[projects."host/owner/repo"]`), overridable per-invocation via `--config-set`
  or `WORKTRUNK_WORKTREE_PATH`. Default is a sibling dir. → herd doesn't impose a
  location; it owns a `herd-my-pi/<name>` branch namespace and respects wt's config.
- `wt merge` does squash+rebase+ff+remove-worktree with pre-merge hooks (local
  CI); `wt remove` discards; `wt list --format json` reports every worktree with
  changes/ahead/behind/unpushed/age.

### Round 7 questions → answers
1. **When to isolate** → opt-in `--isolate`, PLUS per-role `isolate: true`
   frontmatter; if a role expects isolation but spawned without `--isolate`, the
   child warns (notify + widget `⚠`).
2. **Worktree home** → use `wt`'s configured template (respect user config);
   herd owns the `herd-my-pi/<name>` branch namespace; override per-invocation only if
   needed. (User's instinct to "use wt's default" — formalized.)
3. **Phasing** → keep in **Phase 3** (user decision; overrides my lean to pull it
   up). `compact-for-variants` template still ships in Phase 1.
4. **Ephemeral close** → never auto-delete; `⊕ N unmerged herd worktrees` badge
   from `wt list --format json`; `/herd-merge`/`/herd-discard` wrap
   `wt merge`/`wt remove`; default `autoDiscardOnClose=false`.
5. **Parallel flow** → **option 3 only**: ship `compact-for-variants` as the 6th
   prompt template (Phase 1); reject the first-class `/herd-variants` fan-out
   command (it's the sub-agent pattern herd exists to reject, and duplicates wt's
   own parallel-launch).

### The parallel-flow example that made option 3 click

Scenario: prototype a rate-limiter, 3 approaches (token-bucket / sliding-window /
Redis). Side-by-side:
- **Option 3 (template):** run `/compact-for-variants` → orchestrator replies
  with a menu (A/B/C + goals + branch names) → **you** manually run
  `/herd-new --isolate prototyper-rl-{a,b,c}`, `/herd-push` each, `/herd-pull`
  each, then `/herd-merge` the winner + `/herd-discard` the losers. ~9 commands,
  zero new herd code, human drives every spawn.
- **Option 2 (command):** one `/herd-variants "…" --count 3` → the **extension**
  spawns 3 agents and distributes the work → you just review and merge. ~4
  commands, but herd gains a fan-out code path that either auto-summarizes (= the
  rejected orchestrator) or barely beats the manual flow — and duplicates `wt`'s
  own `wt switch -x … -c`.

The crux: option 3 scales the *thinking* without scaling the *machinery*;
option 2 trades the thesis for convenience. Chose option 3.

### Refinement summary (new/changed)
- `wt` becomes a runtime dependency (alongside `herdr`) — but only when
  `--isolate` is used; Phase 1 takes the minimal cut, lifecycle in Phase 2.
- **Phase 1** gets: `/herd-new --isolate` (wraps `wt switch -c -x`), the spawned
  agent writes its worktree branch into its state row, and `compact-for-variants`
  (6th template). Safe parallel prototyping from the MVP.
- **Phase 2** gets the worktree lifecycle: `/herd-merge <name>` (wraps
  `wt merge`), `/herd-discard <name>` (wraps `wt remove`), the
  `⊕ N unmerged herd worktrees` badge (reads `wt list --format json`), and the
  per-role `isolate: true` warning (notify + widget `⚠`).
- **Phase 3** drops its worktree-isolation section (moved up); it keeps only
  cooperative agent-side pull, optional lead-agent mode, cross-workspace `--all`.
- Remaining gap (now small): Phase 1 isolated agents have no herd-managed
  cleanup — reconcile with bare `wt merge`/`wt remove` until Phase 2.

See [design_decisions.md](./design_decisions.md) D21–D25 (D25 updated for the
minimal-cut phasing) and the updated
[spec/phases/phase-1-closed-loop/](./spec/phases/phase-1-closed-loop/) +
[spec/phases/phase-2-polish-templates/](./spec/phases/phase-2-polish-templates/) +
[spec/phases/phase-3-automation-escapes/](./spec/phases/phase-3-automation-escapes/).

## What's next

The detailed Phase-1 technical plan (module/file layout, herdr CLI surface map,
widget render+refresh model, per-command contracts, config + state.json schema,
explicit Phase 2/3 boundaries) — produced from this record. Phase 0 and Phase 1
are now implemented; Phase 2 is **in progress** (`/herd-focus` interactive overlay
shipped); Phase 3 remains spec-only. See [spec/phases/](./spec/phases/) for the
per-phase `done.md` tracking.
