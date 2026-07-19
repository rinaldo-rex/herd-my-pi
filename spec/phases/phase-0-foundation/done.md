# Phase 0 — Done

- [x] herdr availability & identity — `isHerdrAvailable()`, `getCurrentPaneInfo()` (env + fallback)
- [x] Surface creation — `createTab()`/`createSplit()` arg builders mirroring herdr 0.7.4 flags (incl. `--env`)
- [x] Pane inspection — `inspectPane()`/`listPanes()` parsing real herdr JSON
- [x] Transport — `sendCommand()`/`sendEscape()`/`closePane()`
- [x] Shared state IO — `loadState()`/atomic `saveState()`, `writeSelfRow()` (undefined-safe merge), `readRoster()` = JOIN(herdr pane list, state.json) per D26
- [x] Config — `loadConfig()` merging `.pi/herd-my-pi/config.json` over DEFAULTS
- [x] Heartbeat — interval (unref'd) refreshing git status + `lastActivityMs`
- [x] Entry — `session_start` → writeSelfRow+heartbeat; `session_shutdown` → stop+remove
- [x] 20 vitest tests (real herdr JSON fixtures, temp-dir state IO, roster join)
- [x] `tsc --noEmit` clean against real `@earendil-works/pi-coding-agent`
- [x] Live two-pane smoke test passed — `.pi/herd-my-pi/state.json` had both rows
- [x] Naming convention settled: dir = `.pi/herd-my-pi/`, branchPrefix = `herd-my-pi/`, env var = `HERD_MY_PI_NAME`
- [x] Merged as PR #1 (squash → `05a5968` on `main`)
