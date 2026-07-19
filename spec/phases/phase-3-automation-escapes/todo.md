# Phase 3 — Todo

Automation escapes. Track progress here. **Only start after Phase 2 is smooth.**

## Cooperative agent-side pull
- [ ] Register a `herd_pull` pi **tool** (agent-callable)
- [ ] Two-hop transport reusing `/herd-emit-last` + `/herd-receive`
- [ ] Opt-in per agent (role frontmatter or config)
- [ ] Per-turn call cap (config); surface pulls in the widget

## Optional lead-agent mode
- [ ] `herd_push` tool for a designated lead role (agent-initiated push)
- [ ] Lead marker in widget (distinct from ★-main)
- [ ] Document the D1 ("human only") tradeoff in philosophy.md

## Cross-workspace `--all` view
- [ ] `/herd --all` enumerate panes across all workspaces
- [ ] Default stays single-workspace

## Per-agent working-tree isolation
- [ ] `/herd-new --isolate` → spawn into a dedicated git worktree
- [ ] Roster shows worktree branch per isolated agent
- [ ] `/herd-merge <name>` reconcile worktree → main
- [ ] `/herd-discard <name>` drop worktree
- [ ] Cleanup on close (no orphaned worktrees)
