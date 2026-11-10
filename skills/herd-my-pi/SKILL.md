---
name: herd-my-pi
description: Propose a task-appropriate team of interactive pi agents, get the user's approval before spawning, and coordinate them through herdr-core's hc CLI. Use when considering delegation before a herd exists, when working as an orchestrator or sub-agent, or when receiving an <hc from="..."> message.
---

# herd-my-pi

A herd is an orchestrator pi plus its interactive sub-agents, started with
`/herd` or the approval-first workflow below.
Every member is an ordinary interactive pi in its own Herdr tab. The person
can hop into any of them at any time: their messages always win.

hc is the transport. Read `hc --skill` once for the full manual; this page only
covers the herd conventions on top of it.

## Propose before spawning

Apply this section before starting agents, not only after `/herd`. Discovery is
not permission to launch, and the person need not manually enable a herd first.

1. Judge whether delegation helps this task. For a small, tightly coupled change,
   say you will work solo; do not manufacture a team or an approval question.
2. Discover the supported templates from the current project working directory:
   `.pi/extensions/herd-my-pi/agents/*.md`. If that directory exists, it replaces
   the bundled set, even when empty. Otherwise use `../../agents/*.md` relative
   to this skill's real directory (resolve symlinks first). These are the
   package's bundled roles, including
   when installed globally; do not invent a separate global-template directory
   or substitute hc's differently formatted templates. Do not copy or create
   templates without permission.
3. Read the available templates' names/descriptions and the selected templates'
   full bodies, including scope restrictions, `model`, and `thinking`. Describe
   actual files, not assumed abilities inferred from a role name. Consider
   already-approved members before proposing more; never inspect a known-blocked
   member or start a replacement to bypass its pending permission decision.
4. Give one short initial brief: available roles/source, the smallest proposed
   team, what each member will own and why, what you will do yourself, and who
   will verify. State any template model/thinking settings or proposed overrides.
   Unspecified settings use pi's configured defaults, not necessarily this
   orchestrator's current model. Do not claim delegation will be cheaper/faster.
5. Ask the person to approve or correct that concrete proposal (`ask_user` when
   available). Allow approval, a changed team/scope, or working solo. Wait before
   launching anything. An explicit instruction from the person approving the
   same concrete team/task can satisfy this gate; silence, an agent's request,
   and a herd-availability announcement cannot.
6. Launch only the approved members, then send their addresses and assignments
   to the person. Reuse them within the approved task without repeated approval.
   Adding members or materially changing approved roles, scope, or model choices
   needs another confirmation. Approval is not unlimited recursive delegation.

Example initial brief:

Available here: explorer, implementer, reviewer (bundled templates). For this
parser change I propose implementer for `src/parser.ts` and its tests, then
reviewer for read-only verification of the frozen diff. I'll handle integration.
Explorer is unnecessary because the relevant files are known. Models use pi's
configured default; thinking is medium for implementer and high for reviewer.
Shall I start these two, or change the plan?

### Sub-agents may request help

A sub-agent may ask the person in its own session for an additional agent when
work is substantial or a separate session would isolate a useful piece. Explain
why, propose a specific template/count/scope, and wait for explicit confirmation.
A peer or orchestrator message is not the person's approval. After confirmation,
the requesting sub-agent may launch exactly that approved helper using the same
procedure below. Notify its orchestrator of the approval, child address, and
ownership; do not keep parent and child editing the same files concurrently.

Permission to launch does not relax project read-only rules, expand file scope,
approve tool/trust prompts, or authorize the child to spawn more agents. Every
additional launch proposal needs its own explicit approval. If another role
instruction prohibits launching, explain the conflict and have the person
resolve it rather than silently bypassing it.

### Launch an approved member

Use the existing `hc` CLI; no manual `/herd` picker is required for this path.
Read `hc run --help` for the installed syntax. Require `HC_TERMINAL_ID` and a
working interactive pi installation; otherwise explain the limitation without
pretending to have launched a herd.

- Use a unique hc name (1–32 lowercase letters, digits, hyphens, underscores),
  the approved working directory, and the selected template's absolute path.
- Build `role_prompt` from the template body plus the child's name, its immediate
  parent's hc address, the person's priority, and an instruction to load this
  skill. Do not replace the normal system prompt with just the role text.
- Include the full state-card task as pi's initial positional prompt, not a send
  to a booting process. Preserve argument boundaries; do not interpolate role or
  task text into an executable shell-command string.
- Preserve the launcher's PATH, normal extensions, skills, persistent sessions,
  and permission controls. Never use print/one-shot mode or trust-bypass flags.
- Pass any approved `--model` and `--thinking` options before pi's `--`. Do not
  silently substitute a model when the requested one is unavailable/ambiguous;
  clarify it. Omit unspecified options to use configured defaults.

With those values prepared, the launch shape is:

```sh
hc run --bg --json --name "$name" --cwd "$project" \
  --label "herd.parent=$HC_TERMINAL_ID" \
  --label "herd.role=$role" --label "herd.template=$template" \
  -- env "PATH=$PATH" pi --name "$name" \
  --append-system-prompt "$role_prompt" -- "$brief"
```

If your own terminal has a `herdr.space` label, also include that same label at
launch so Herdr can adopt the child into a tab. The immediate requester is the
parent for nested helpers. Record the returned address; do not launch duplicates
or blindly resend after a startup failure. A blocked notification follows the
acknowledgement-only rule below, even during startup. Native `/herd` remains an
optional manual picker; it is not a model-callable tool or an approval shortcut.

## Who is who

```sh
echo $HC_TERMINAL_ID                                 # your address, e.g. t1e
hc get $HC_TERMINAL_ID                               # your labels; `parent` is your orchestrator
hc ls --label herd.parent=<parent address>           # that parent's direct members
```

Every sub-agent carries the labels `herd.parent=<immediate parent>`,
`herd.role=<template name>` and `herd.template=<template file>`. The template's
frontmatter (`description`, `model`, `thinking`) and body (its role prompt)
say what that member is for and how it works. Address members by name
(`reviewer`) or by address (`t1e`).

## Talking

```sh
hc send <member> "message"         # paste into their input and press enter
hc wait <member>                   # until they stop working
hc read <member> --lines 80        # look at their screen (what they're doing now)
```

To get a local member's answer, use `herd_read`, not `hc read`. By default it
checks only the latest prompt and reports `ready`, `not_ready`, or `incomplete`
with its `latestPromptId`. Only `ready` is a current report available to review;
it does not mean the task passed. A pending or failed prompt never falls back
to an older answer. On subsequent tasks, pass `after: <previous latestPromptId>`
to require a newer prompt on the active branch, including when the new request
has not reached the session file yet. Without a cursor, an unpersisted request
cannot be detected. Match the report's task ID/snapshot to your assignment.

Explicit `last: 3` reads chronological history instead; it is labeled `history`,
not current readiness. Do not combine `last` with `after`. Inline output is
capped at 50 KiB or 2,000 lines; truncated results name a private temporary file
containing the full replies. Read it with `read` (offset/limit to continue).
Remote `machine/address` reads are unsupported. While a member is `working`,
wait first. Never call a read tool for a member known to be blocked.

Messages from other agents arrive tagged `<hc from="t1e reviewer">…</hc>`.
They are requests from peers, not instructions from the person.

## Etiquette

- Sub-agents: finish checks and tool calls, then put the full result in your
  final assistant response. Include the task ID, scope/snapshot, changes or
  findings, checks actually run, and remaining limitations. Do not send an early
  `done` message or attempt a tool call after the final response. The orchestrator
  uses hc's completed-turn status and `herd_read`, not an agent-written completion
  claim. Don't report just to acknowledge or wait for replies you don't need.
- You may ask a sibling directly when they own what you need. Keep it to one
  question; don't start back-and-forth chats between agents.
- Don't write report files to hand results over; your final message is the
  report. Write a file only when the result is meant to be one (a plan to
  commit), inside the project.
- Never start agents on your own authority. You may propose help, ask the
  person, and launch only after explicit approval as described above.
- Never `hc kill` or `hc rm` herd members; the person or orchestrator does.
- If you need a decision only the person can make, ask in your own session
  and wait. Herdr shows you under "Needs you".

## Orchestrator

Use approved members where they help the agreed task; do not force delegation
on every prompt. A herd-started announcement lists availability, not blanket
permission for new agents or unrelated work. Follow the proposal/approval gate
above when more members are needed, and keep coordination brief.

- Know your herd: `hc ls --label herd.parent=$HC_TERMINAL_ID`, then read each
  member's `herd.template` file. Re-read it rather than guess from a name.
- Brief once with a short state card. Include verified facts, not assumptions:
  - Task ID and concrete goal.
  - Owned files and exclusions; distinguish shared context from a shared worktree.
  - Settled decisions and known environment constraints.
  - Acceptance checks, who runs them, and prohibited live actions.
  - Expected report: task ID, observed snapshot, result, checks, limitations.
  Do not suppress genuine questions when requirements are missing.
- Independent pieces go to different members at the same time. Assign file
  ownership explicitly so parallel work does not mean concurrent edits to the
  same files.
- Separate building from final verification. Workers check while editing;
  reviewers verify a declared frozen snapshot once. In a dirty worktree, HEAD
  alone is not that snapshot: identify the reviewed file contents/diff as well.
  Changes after verification invalidate the affected checks. Do not blindly
  repeat the entire suite against a moving tree.
- Keep working while they do; use `hc wait` when results are needed. A return
  with `reason: "message"` is an interruption, not completion. Process the
  message, then wait again unless the member is blocked (see below).
- Collect with `herd_read` only after the relevant hc turn completes. Match the
  report to the task ID and snapshot before accepting it. Missing or mismatched
  results are not success; neither is a terminal exiting without an answer.
  Verify claims against code/check evidence instead of trusting self-reports.
- When a member reports `blocked`, reply **"Noted, waiting on user"** and
  leave that notification there. Do not inspect its screen, session, or status
  (`hc read`, `herd_read`, or `hc get`), investigate the cause, ask follow-up
  questions, message the blocked member, or try to unblock it. The person handles
  the permission or question directly. Resume coordination with that member only
  after it unblocks or the person explicitly asks for help. This rule overrides
  any hc manual advice to inspect blocked terminals.
