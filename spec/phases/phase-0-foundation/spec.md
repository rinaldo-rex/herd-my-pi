# Phase 0 — Foundation

> No UI, no commands. The herdr CLI wrapper + pane/agent discovery + shared
> state primitives that every command and the widget depend on. Pure
> functions, fully testable in isolation.

**Status:** not started · **Depends on:** nothing · **Unblocks:** Phase 1

## Goal

Build the herdr-facing and state-IO layer as a standalone, tested module so
that Phase 1 commands and the widget are pure composition over it. Nothing in
this phase is user-visible.

## Scope

### 1. herdr availability & identity
- `isHerdrAvailable()` — `HERDR_ENV === "1"` and `herdr` on PATH.
- `getCurrentPaneInfo()` — resolve `pane_id`, `tab_id`, `workspace_id` from
  env (`HERDR_PANE_ID`/`HERDR_TAB_ID`/`HERDR_WORKSPACE_ID`), falling back to
  `herdr pane current` for older herdr builds (port the reference's robust
  fallback).

### 2. Surface creation (reused by `/herd-new`)
- `createTab(name, cwd, workspaceId)` → paneId (root pane of the new tab).
  Args mirror the reference's `buildTabCreateArgs` (`tab create --workspace
  --label --cwd --no-focus`).
- `createSplit(name, direction, cwd)` → paneId (`pane split <parent> --direction
  --no-focus --cwd`).
- `renamePane(paneId, name)` / `renameTab` / `renameWorkspace` (cosmetic,
  best-effort, swallow errors).

### 3. Pane inspection & enumeration (reused by widget + push/pull)
- `inspectPane(paneId)` → `{ kind: present|missing|unavailable, agent?,
  agentStatus: idle|working|blocked|done|unknown }` (port the reference's
  `parsePaneGetOutput`/`parsePaneGetError`).
- `listPanes(workspaceId)` → `herdr pane list --workspace <id>` (**confirmed
  in herdr 0.7.4**; resolves the speculative note). Returns structured JSON:
  each pane carries `pane_id`, `agent` (`"pi"` when a pi agent is running),
  `agent_status` (`working|idle|blocked|unknown`), `cwd`,
  `agent_session.value` (the session `.jsonl` path), `focused`, `tab_id`,
  `terminal_title`. This is the live source the widget JOINs with state.json
  (D26).
- `readCurrentPaneId()` → `herdr pane current` (for the "current agent" highlight).

### 4. Transport primitives (reused by push/pull)
- `sendCommand(paneId, text)` — `herdr pane run <paneId> <text>` (send text +
  Enter in one socket request; port `sendHerdrCommand`).
- `sendEscape(paneId)` — `herdr pane send-keys <paneId> Escape` (for `--force`
  interrupt).
- `closePane(paneId)` — `herdr pane close`.

### 5. Shared state IO (`.pi/herd/state.json`)
- `loadState()` / `saveState(state)` — read/write the shared roster state file
  with a atomic-write (temp + rename) to avoid torn reads across peer
  instances.
- `writeSelfRow(row)` — merge/replace this instance's own row (keyed by
  `paneId`); stores **herd-unique fields only** (D26 — model/thinking/
  workingTree/branch/timing/isMain; NOT cwd/agent_status, those come from
  herdr live). Called on startup, on model/thinking change, and on heartbeat.
- `readRoster(workspaceId)` — JOIN `herdr pane list --workspace <id>` (live:
  presence/agent_status/cwd/session/focused) with `state.json` (herd-unique
  supplements) ON `paneId`, current-workspace only (D11). A row in state.json
  whose pane is missing from `pane list` = exited (closed-pane transient; the
  widget decides to show-then-drop). Sorting (current pinned, stale sinks) is
  the widget's job, not here.
- State row schema (v1, **refined per D26 — herd-unique fields only**):
  `{ paneId, name, type: "tab"|"pane", workspaceId, model, thinking,
  workingTree: "clean"|"dirty"|null, branch, worktreePath, lastActivityMs,
  startedMs, isMain }`. Presence/`agent_status`/`cwd`/session path are NOT
  stored — read live from `herdr pane list` (§3) and JOINed at roster time.

### 6. Heartbeat & self-update
- An interval (configurable; default ~2s) that refreshes this instance's
  `lastActivityMs`, re-checks `git status --short` in its own cwd, and rewrites
  its row. Stops on session end.

## Out of scope (deferred)
- Any `/herd-*` command registration.
- Any widget rendering (`ctx.ui.setWidget`).
- Templates, role agents, `/herd-init`.
- Cross-workspace enumeration, hide/unhide.

## Risks / open impl details
- ~~Exact `herdr pane list` shape and flags~~ — **resolved**: confirmed
  against `herdr 0.7.4` (structured JSON per pane; see §3). Identity env
  (`HERDR_PANE_ID`/`_TAB_ID`/`_WORKSPACE_ID`/`HERDR_ENV`) confirmed live.
- `state.json` write contention across many peers — atomic rename + last-writer
  per-row is sufficient for v1; document the tradeoff.
- Working-tree `git status` cost per heartbeat across many panes — keep it
  cheap (`--short`, no porcelain v2 in v1), throttle if cwd isn't a git repo.

## Files (scaffolded on branch `herd/phase-0`)
```
src/herdr.ts          # availability, identity, surfaces, inspection, transport
src/state.ts          # state.json load/save, writeSelfRow, readRoster (herdr join)
src/config.ts         # load .pi/herd/config.json over package defaults
src/heartbeat.ts      # startHeartbeat(): interval → refresh + writeSelfRow
src/types.ts          # shared types (PaneRow, RosterRow, HerdrPane, Config)
extensions/index.ts   # thin entry: session_start→writeSelfRow+heartbeat; session_shutdown→stop. No commands/widget.
config.json           # package default config (glyphs, thresholds, intervals)
config.json.example   # documented override example
tests/*.test.ts       # vitest unit tests (pane get/list JSON fixtures, atomic-write contention)
```
