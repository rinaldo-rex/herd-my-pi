# herd-my-pi

> **herd** (verb) · **my** · **pi** (agents) — guide and steer your own pi
> agents, exclusively within [herdr](https://herdr.dev).

A pi Package for orchestrating **multi-agent** workflows where the human is the
orchestrator and agents are persistent, interactive panes you hop between and
co-drive. Not a sub-agent framework.

## Status

Phases 0–2 are **implemented** and tested (66 vitest tests, `tsc` clean,
live e2e smoke-tested). Phase 3 remains spec-only.
This README indexes the design documentation produced during
the v1 brainstorm.

## Documentation

| Doc | What it is |
|---|---|
| [philosophy.md](./philosophy.md) | The core thesis, the control-axis flip, the five principles. Read first. |
| [design_decisions.md](./design_decisions.md) | ADR-style record: 20 decisions, options considered, rationale. |
| [brainstorm_v1.md](./brainstorm_v1.md) | The living narrative of the brainstorm (research, rounds, refinements). |
| [spec/phases/](./spec/phases/) | Per-phase spec + todo + done. |

## Phases

- **[Phase 0 — Foundation](./spec/phases/phase-0-foundation/)** — herdr CLI
  wrapper + pane discovery + shared `state.json` primitives. No UI, no commands.
- **[Phase 1 — The Closed Herd Loop](./spec/phases/phase-1-closed-loop/)** —
  `/herd`, `/herd-init`, `/herd-new`, `/herd-push`, `/herd-pull` + bundled
  templates & roles. The first useful thing.
- **[Phase 2 — Polish & Templates](./spec/phases/phase-2-polish-templates/)** —
  interactive selectable widget, badges, `/herd-save`/`/herd-resume`/`/herd-hide`.
- **[Phase 3 — Automation Escapes](./spec/phases/phase-3-automation-escapes/)** —
  cooperative agent-side pull, optional lead-agent mode, cross-workspace view,
  worktree isolation. Only once the manual flow is smooth.

## The one-line differentiation

> Unlike sub-agent workflows where you can't hop in and control a sub-agent's
> context, model, or task — herd-my-pi agents are normal interactive pi panes
> you drive yourself. The widget is a roster, not a status projector; push/pull
> are a courier, not an injection.
