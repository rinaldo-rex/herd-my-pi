# Phase 3 — Automation Escapes

> Where the herd starts drifting toward the sub-agent pattern being rejected.
> Build only once the manual flow is so smooth you know exactly which seam to
> automate — and never at the cost of human control.

**Status:** not started · **Depends on:** Phase 2 · **Unblocks:** —

## Scope

### Cooperative agent-side pull (no central orchestrator)
- A pi **tool** (not a slash command) registered by the extension that lets an
  *agent* (not just the human) request another peer's last assistant message:
  the agent calls `herd_pull("scout")` and gets scout's last message as a tool
  result.
- Two-hop, same transport as `/herd-pull`, but initiated by the model via a
  tool call. Keeps the human-out-of-the-loop option available without a
  coordinator process.
- Guard: the tool is opt-in per agent (role frontmatter or config), so it
  doesn't silently turn every herd into an auto-mesh.

### Optional lead-agent mode
- A designated "lead" role that can `herd_push` (agent-initiated push) to peers
  — the closest the herd gets to sub-agent orchestration, but always
  overridable by a human hopping in.
- Clearly marked in the widget (a different marker than ★-main).

### Cross-workspace `--all` view
- `/herd --all` shows panes/tabs across all herdr workspaces (for multi-herd
  users). Default stays single-workspace.

## Risks / open impl details
- Cooperative pull tool must not become a runaway-fan-out vector — cap calls
  per turn (config), surface in the widget when an agent pulls.
- Lead-agent mode blurs the "human only" thesis from D1; document the tradeoff
  prominently in philosophy.md if adopted.

## Out of scope (explicitly not planned)
- A central orchestrator process / auto-spawn loops / auto result-injection.
  These are the sub-agent patterns herd-my-pi exists to reject.
