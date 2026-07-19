# Phase 1 — Done

Move items here as they're completed (with commit/PR ref).

## Core implementation (Phase 1a)
- [x] Widget utilities (`extensions/widget.ts`) — formatElapsed, elapsedTier, colorElapsed, formatRow, formatClosedRow, sortRows, shortModel
- [x] `/herd-init` command (`extensions/herd-init.ts`) — scaffold prompts, agents, config
- [x] `/herd` toggle + display widget (`extensions/herd.ts`) — roster display, refresh timer, closed-pane transients
- [x] `/herd-new` spawn (`extensions/herd-new.ts`) — named spawn, --isolate flag, role discovery
- [x] `/herd-push` + `/herd-receive` (`extensions/herd-push.ts`) — message ferrying with editor widget
- [x] `/herd-pull` + `/herd-emit-last` + `/herd-receive-pull` (`extensions/herd-pull.ts`) — two-hop round-trip pull
- [x] Entry point wiring (`extensions/index.ts`) — all commands registered, lifecycle managed
- [x] 6 prompt templates (`prompts/*.md`) — exploration, debug, prototype, review, handoff, variants
- [x] 4 role agents (`agents/*.md`) — explorer, debugger, prototyper, reviewer
- [x] 18 widget tests (`tests/widget.test.ts`) — formatElapsed, elapsedTier, colorElapsed, sortRows, formatRow, formatClosedRow
- [x] `tsc --noEmit` clean
- [x] All 38 tests passing (20 Phase 0 + 18 Phase 1 widget)
