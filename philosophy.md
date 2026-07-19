# herd-my-pi — Core Philosophy

> **herd** (verb) · **my** · **pi** (agents)
> You herd *your own* pi agents — guiding, steering, and co-driving them —
> exclusively within [herdr](https://herdr.dev).

## The one-sentence thesis

A herd is a set of **persistent, interactive pi panes you hop between**, with a
human as the orchestrator and a tiny widget + a few verbs to ferry context
between them. That's it. Everything else follows from refusing to make the
agents fire-and-forget.

## What this is NOT

It is **not** a sub-agent framework. The canonical sub-agent workflow (and the
reference project `pi-herdr-subagents`) is async and fire-and-forget: you call
`subagent()`, it returns immediately, the child runs in a black box, and a
summary is *steered back* into the parent when it finishes. The parent never
touches the child's context, model, or thinking. You wait. You trust the
summary.

The community has documented exactly how that fails (the dibi8 postmortem's
five failure modes — trust trap, context bleed, runaway fan-out, silent
truncation, orphaned worktree — all sharing one root: **treating an agent's
claim as verified reality**). Every fix in that postmortem is a *prompt
discipline* band-aid: verify against artifacts, disjoint scopes, budget caps,
make truncation loud. None of them give you the wheel back.

herd-my-pi refuses that model by construction. There is no black box.

## The control-axis flip

herd-my-pi flips the control axis from **agent-orchestrates-agents-fire-and-forget**
to **human-is-the-orchestrator, agents-are-persistent-interactive-shells-you-hop-between**.
It is closer to "tmux for agents" than to "subagent fan-out."

Concrete consequences of the flip:

- You can *watch* an agent work, in real time, in its own pane. No trust trap —
  you see what it actually did, not what it claims.
- You can *intervene* mid-run: hop into a pane, change its model with pi's
  native `/model`, redirect it, abort it. The widget reflects the change.
- You can *ferry* context deliberately between agents — `push` your distilled
  last message into another agent, `pull` another agent's last message into your
  next input. Both editable. Nothing is auto-injected.
- You spawn agents *deliberately, by name*. No reflexive fan-out, no runaway
  loops, no runaway cost.
- Overlap is *visible*: the roster shows working-tree state per agent, so
  context bleed and orphaned worktrees become your explicit choice, surfaced
  on the roster — not a silent race.

## The five principles

1. **The human is the orchestrator.** No agent spawns or steers other agents in
   v1. Automation is a Phase-3 escape hatch, added only once the manual flow is
   so smooth you know exactly which seam to automate — and never at the cost of
   human control.

2. **Agents are persistent and interactive.** A herd agent is a normal pi pane
   you can type into. You don't "invoke" a sub-agent; you *drive* a peer. The
   only inbound channel to an interactive pane is keystroke injection — which
   is why the transport is `herdr pane run` carrying base64 extension commands,
   not RPC sockets (RPC would force the pane into headless mode and break
   interactivity).

3. **Push and pull are dumb plumbing; compaction is the smarts.** `/herd-push`
   ferries *your* last assistant message into a target's input; `/herd-pull`
   ferries a target's last message into yours. Both are mirror images. The
   *quality* of what gets ferried is shaped upstream by the `compact-for-*`
   prompt templates run on the source agent first. Transport is symmetric and
   dumb; distillation is deliberate and smart.

4. **Verify by watching, intervene by design.** The herd dissolves the
   postmortem's five failures structurally rather than via prompt discipline:
   - Trust trap → you watch them work; the summary is never the ground truth.
   - Runaway fan-out → you spawned them, deliberately, by name.
   - Silent truncation → you can pull the raw last message any time.
   - Context bleed → working-tree state is a roster badge.
   - Orphaned worktree → the roster makes ownership visible.

5. **herdr-only, peer topology.** The package requires `HERDR_ENV=1` and the
   `herdr` CLI. There is no "parent" process that owns children; a herd is a
   peer mesh of pi instances in one herdr workspace, each running this
   extension, each showing the same roster (read from shared state), each able
   to herd any peer. A `★` marks the pane where the herd started (the
   "orchestrator," for semantic clarity only) — tracked via an env var passed
   to spawned children. There is no orchestrator *process*.

## What "modify an agent from within their shell" really means

Point #2 of the original idea — "I should be able to modify any agent from
within their agent shell (model, thinking effort) and that should reflect in
this widget" — is the *primary* differentiation from sub-agent workflows, where
you can't hop in and control a sub-agent's context, model, or task.

In herd-my-pi this is literal: you walk to that pane and change its model with
pi's own `/model` (or Ctrl+P). The extension in that pane writes the new model
to the shared roster state, and every peer's widget reflects it on the next
refresh. There is no out-of-band override channel and no need for one. Model
and thinking are a **`/herd-new` concern** (you pick them when you spawn, or
inherit the role's defaults), and they persist for the agent's lifetime. To
re-route a flow, use pi's native `/tree`. `/herd-push` carries no model — only
the message.

## Scope discipline

herd-my-pi stays small on purpose. The reference sub-agent project carries
status projection, steering-back, lifecycle state machines, resume, and
interrupt tools — because fire-and-forget *needs* them to approximate the
control you'd have if you just drove the pane yourself. herd-my-pi discards all
of that machinery and keeps only what a human co-driving peers actually needs:
a roster, a handful of verbs, and a few compaction templates. Complexity you
can't verify is worse than simplicity you can.
