# Phase 1 — The Closed Herd Loop

> The smallest set that demonstrates the differentiation: a human co-driving
> multiple persistent interactive pi panes with a live roster and editable,
> symmetric message ferrying. Remove any piece and the loop breaks.

**Status:** not started · **Depends on:** Phase 0 · **Unblocks:** Phase 2

## Goal

Deliver the four commands + the display-only widget + `/herd-init` + bundled
templates/roles that close the herd loop end-to-end. This is the first
*useful* thing.

## Scope

### `/herd` — toggle the display-only roster widget
- Registered via `pi.registerCommand("herd", ...)`.
- Uses `ctx.ui.setWidget("herd", lines, { placement: "aboveEditor" })` (tui.md
  Pattern 5); `undefined` to clear.
- Visibility is per-instance, in-memory; on startup, if `HERDR_HERD_WIDGET=1`
  is set (passed by `/herd-new` to spawned children), show the widget.
- **Render model:** on a refresh timer (default ~1s, configurable), read
  `.pi/herd/state.json` via Phase-0 `readRoster(myWorkspaceId)`, then:
  - Determine current pane via `readCurrentPaneId()`; pin that row to top with
    `▶`.
  - Mark the `★`-main row (paneId === `HERDR_HERD_MAIN_PANE`).
  - Render each row: `▶? ★? ◆|◇ name  model  wt-state  elapsed`.
  - Color elapsed by threshold (green <2m, amber 2–10m, red >10m, pulse >30m);
    glyphs/colors via `theme.fg()`.
  - Sort: current pinned top, then by `lastActivityMs` descending (stale sinks).
  - Closed panes: show a transient "X exited" line for a configurable duration,
    then drop (D18).
- No row selection in v1 (that's Phase 2). Display-only.

### `/herd-init` — scaffold the local herd
- Idempotent + merge (never overwrite user edits); `--force` resets (D19).
- Materializes into:
  - `.pi/prompts/*.md` — the five `compact-for-*` templates (editable).
  - `.pi/agents/*.md` — the four role agent definitions (editable).
  - `.pi/herd/config.json` — herd config (glyphs, thresholds, intervals,
    collision policy, default pane direction) merged over package defaults.
- Does NOT touch `.pi/settings.json` (pi auto-discovers `.pi/prompts/` and
  `.pi/agents/`).

### `/herd-new` — spawn a herd agent
- `pi.registerCommand("herd-new", ...)`; arg: optional `<name>`.
- With a name: spawn a **side pane** (default; D10) via `createSplit`, start pi
  in it, pass `HERDR_HERD_MAIN_PANE=<myPaneId>` + `HERDR_HERD_WIDGET=1` to the
  child env, write the child's initial state row, auto-enable my own widget.
- Without a name: open a `ctx.ui.custom()` widget (tui.md Pattern 1 SelectList +
  Input fields) with:
  - `name` (required)
  - `type` (pane | tab, default pane)
  - `role` (pick from `.pi/agents/` discovery, or "plain" — optional)
  - `model` + `thinking` (optional; defaults from role or pi; model dropdown
    populated from pi's available models in-process)
  - `goal / extra context` (free text, optional — appended to role system prompt)
- Name collision: **error by default**; configurable to auto-suffix (D17).
- Starting pi in the new pane: type the `pi` launch command (with `--model`/
  `--thinking`/`--name` as chosen) via `sendCommand`; respect
  `PI_SUBAGENT_SHELL_READY_DELAY_MS`-style ready delay (port from reference).

### `/herd-push` — ferry my last message to a target
- `pi.registerCommand("herd-push", ...)`; arg: `<name>`; flag: `--force` (D16).
- Read my own last assistant message in-process (extension API equivalent of
  RPC `get_last_assistant_text`).
- Open a `ctx.ui.custom()` editor widget pre-filled with that message (editable).
- On submit: base64-encode `{ message, from: <myPaneId> }`; resolve `<name>` →
  target paneId from roster state; if target is mid-turn → **queue by default**
  (send as a steering message after the current turn) or `--force` →
  `sendEscape(target)` then push.
- Deliver via `sendCommand(target, "/herd-receive <base64>")`.
- Register the receiving end: `pi.registerCommand("herd-receive", ...)` (hidden
  from autocomplete if possible) that decodes the base64 and injects `message`
  as this pane's next prompt via the extension API (`pi.sendMessage()`-style).
  No model/thinking handling (D6).

### `/herd-pull` — ferry a target's last message into my input
- `pi.registerCommand("herd-pull", ...)`; arg: `<name>`; flag: `--edit`.
- Resolve `<name>` → target paneId. Two-hop round-trip:
  1. `sendCommand(target, "/herd-emit-last --to <myPaneId>")`.
  2. Target's `/herd-emit-last` (registered command) reads its own last
     assistant message in-process, base64-encodes, and
     `sendCommand(myPaneId, "/herd-receive <base64>")` back.
- On receipt: default = inject the text into my editor via
  `ctx.ui.setEditorText()` (direct, fast); `--edit` = open the pre-filled
  `ctx.ui.custom()` editor widget.
- Symmetric to push; reuses `/herd-receive` for the inbound hop.

### Bundled resources
- `prompts/compact-for-exploration.md`, `compact-for-debug.md`,
  `compact-for-prototype.md`, `compact-for-review.md`, `compact-for-handoff.md`
  — each with `argument-hint: "<focus>"`, referencing artifacts by path,
  redacting secrets, tailoring to `$1`.
- `agents/explorer.md`, `debugger.md`, `prototyper.md`, `reviewer.md` — role
  definitions with default model + thinking frontmatter.
- All scaffolded editable by `/herd-init`; originals ship in the package.

## Out of scope (Phase 2)
- Selectable widget rows / focus-by-row / `/herd-focus`.
- `/herd-new --template`, `/herd-save`, `/herd-resume`, `/herd-hide`,
  `/herd-unhide`.
- Thinking badge on rows; row detail/tooltip.
- `compact-for-*` template refinements beyond the initial set.

## Risks / open impl details
- Driving another interactive pi's input via `pane run` carrying a base64
  `/herd-receive` command — validate the command actually executes in the
  target (extension commands run even during streaming per rpc.md, but
  confirm for TUI mode).
- Hidden commands: can `/herd-receive`/`/herd-emit-last` be kept off the
  autocomplete palette? If not, document them as internal.
- Spawned pi ready-delay (the reference's `PI_SUBAGENT_SHELL_READY_DELAY_MS`)
  — reuse the env knob to avoid dropped launch commands.
- `sendEditorText` vs editor widget for pull's default inject — confirm the
  in-TUI API name (`ctx.ui.setEditorText` per rpc.md extension UI protocol).

## Files (proposed)
```
extensions/herd.ts           # /herd toggle + widget render + heartbeat wiring
extensions/herd-init.ts      # /herd-init
extensions/herd-new.ts       # /herd-new
extensions/herd-push.ts      # /herd-push + /herd-receive (inbound)
extensions/herd-pull.ts      # /herd-pull + /herd-emit-last (inbound)
extensions/widget.ts         # roster row formatting, color, sort, pulse
prompts/*.md                 # 5 compact-for-* templates
agents/*.md                  # 4 role definitions
```
