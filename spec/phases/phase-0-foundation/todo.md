# Phase 0 — Todo

Foundation layer. No UI, no commands. Track progress here.

## herdr availability & identity
- [ ] `isHerdrAvailable()` (HERDR_ENV + `herdr` on PATH, cached)
- [ ] `getCurrentPaneInfo()` with env + `herdr pane current` fallback
- [ ] Tests for identity resolution (env present / env missing / malformed output)

## Surface creation
- [ ] `createTab(name, cwd, workspaceId)` → paneId (with `--no-focus`)
- [ ] `createSplit(name, direction, cwd)` → paneId (with `--no-focus`)
- [ ] `renamePane` / `renameTab` / `renameWorkspace` (best-effort)
- [ ] Tests for arg building + output parsing (`extractRootPaneId`, `extractHerdrPaneId`)

## Pane inspection & enumeration
- [ ] `inspectPane(paneId)` → present|missing|unavailable + agentStatus
- [ ] `listPanes(workspaceId)` → enumerate panes/tabs with labels + ids
- [ ] `readCurrentPaneId()` → `herdr pane current`
- [x] Confirm exact `herdr pane list` subcommand/flags against installed herdr — **done (herdr 0.7.4: JSON per pane; identity env confirmed)**
- [ ] Tests for `parsePaneGetOutput` / `parsePaneGetError` (port from reference)

## Transport primitives
- [ ] `sendCommand(paneId, text)` — `herdr pane run`
- [ ] `sendEscape(paneId)` — `herdr pane send-keys Escape`
- [ ] `closePane(paneId)` — `herdr pane close`
- [ ] Test: base64 payload round-trips intact through `pane run`

## Shared state IO (`.pi/herd/state.json`)
- [ ] Define `PaneRow` type — **herd-unique fields only (D26)**: paneId, name, type, workspaceId, model, thinking, workingTree, branch, worktreePath, lastActivityMs, startedMs, isMain (NOT cwd/agent_status — live from herdr)
- [ ] `loadState()` / atomic `saveState()` (temp + rename)
- [ ] `writeSelfRow(row)` — merge/replace own row by paneId
- [ ] `readRoster(workspaceId)` — JOIN herdr pane list + state.json by paneId (current-workspace only; exited panes flagged `live:false`)
- [ ] Tests: concurrent-writer safety (last-writer per row), malformed-file recovery

## Config loading
- [ ] `config.json` package defaults (glyphs, staleness thresholds, heartbeat interval, default pane direction, collision policy)
- [ ] `config.json.example` documented
- [ ] `loadConfig()` — merge `.pi/herd/config.json` over package defaults

## Heartbeat & self-update
- [ ] Heartbeat interval (default ~2s, configurable) refreshes lastActivityMs + workingTree + own row
- [ ] Re-check `git status --short` (skip if not a git repo)
- [ ] Stop on session end

## Packaging & tests
- [ ] `package.json` with `pi-package` keyword + `pi` manifest (`extensions`)
- [ ] peerDependencies for `@earendil-works/*` + `typebox`
- [ ] vitest devDependency + `npm test` script
- [ ] README stub referencing philosophy.md / design_decisions.md
