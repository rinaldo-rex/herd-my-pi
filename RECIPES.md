# herd-my-pi — Recipe Book

A scenario-by-scenario guide to herding your pi agents. Each recipe shows the
exact command sequence, the herdr pane layout at each step, and what you
should see in the roster widget.

**Prerequisites:** herdr running, `herd-my-pi` installed globally, inside a
git-tracked project. Every command is typed in pi's input (`/` prefix).

---

## Recipe 1 — First herd

> Install, scaffold, spawn your first agent, toggle the widget.

**Goal:** go from zero to seeing a live roster with one agent.

```
  before                         after
  ┌──────────────────┐           ┌──────────────────┬──────────────┐
  │                  │           │                  │              │
  │   orchestrator   │           │   orchestrator   │    scout     │
  │   (★ main)       │           │   (★ main)       │              │
  │                  │           │                  │              │
  │                  │           │  ╭─ Herd ───────╮│              │
  │                  │           │  │ ▶ ★ ● scout  ││              │
  │  /herd-init      │           │  │        clean ││              │
  │  /herd-new scout │           │  ╰──────────────╯│              │
  │  /herd           │           │                  │              │
  │                  │           │                  │              │
  └──────────────────┘           └──────────────────┴──────────────┘
```

1. `/herd-init`
   - Scaffolds `.pi/prompts/`, `.pi/agents/`, `.pi/herd-my-pi/config.json`.
   - Safe to run repeatedly; never overwrites your edits. Use `--force` to reset.
2. `/herd-new scout --role explorer`
   - Spawns a side pane named "scout" with the explorer role.
   - Scout gets `HERDR_HERD_WIDGET=1` so its widget auto-shows.
3. `/herd`
   - Toggles your roster widget above the editor.
   - Cycles: `off → compact → detail → detailAll → off`.
4. You now see two panes. The roster shows `▶ ★ ● scout` with your pane as `▶`
   (current) and `★` (where the herd started).

**What you have:** a two-pane herd. Scout is a normal pi pane — you can hop into
it, type, change its model, anything.

---

## Recipe 2 — Explore an unfamiliar codebase

> Spawn an explorer, focus it on an area, pull back a structured briefing.

```
  step 1                           step 2
  ┌────────┬──────────────┐        ┌────────┬──────────────┐
  │  you   │    scout     │        │  you   │    scout     │
  │  (★)   │   (explorer) │        │  (★)   │  exploring…  │
  │        │              │        │        │              │
  │/herd-  │              │        │pull    │              │
  │push    │              │        │briefing│              │
  │scout   │              │        │        │              │
  │--compact              │        │        │              │
  │explor- │              │        │        │              │
  │ation   │              │        │        │              │
  │"auth"  │              │        │        │              │
  └────────┴──────────────┘        └────────┴──────────────┘

  step 3 — you have the briefing in your editor
  ┌─────────────────────────────────────┐
  │  you (★)                            │
  │                                     │
  │  ## Scope                           │
  │  Examined: src/auth/, src/middleware│
  │  Skipped: tests/ (no auth tests)    │
  │                                     │
  │  ## Findings                        │
  │  - src/auth/login.ts: entry point   │
  │  - JWT stored in localStorage (⚠)   │
  │  - No rate-limiting on /login       │
  │                                     │
  │  /herd-new debugger --role debugger │
  └─────────────────────────────────────┘
```

1. `/herd-new scout --role explorer`
2. `/herd-push scout --compact compact-for-exploration "auth module"`
   - `--compact` injects the exploration template + focus into *your* agent.
   - Your pi runs the template and produces a briefing as its last message.
   - (If you omit the template name, you get a dropdown picker.)
3. Your agent responds with the briefing. Now push:
4. `/herd-push scout`
   - Opens an editor pre-filled with your last assistant message (the briefing).
   - Edit if needed, submit. Scout receives it as `/herd-receive`.
5. Scout processes the briefing and starts exploring.
6. When scout looks idle (check the roster dot), `/herd-pull scout`
   - Scout's last message drops into your editor. Direct inject, no editor unless
     you say `--edit`.
7. Now you have the structured findings. Decide next steps.

**Why this is better than asking pi directly:** scout is a separate context
window — your main session stays clean. Scout's exploration doesn't pollute
your working context with file contents. You only get the compacted summary.

---

## Recipe 3 — Debug a crash or bug

> Spawn a debugger, push symptoms, watch it work, pull the fix.

```
  ┌────────┬──────────────────────────────┐
  │  you   │          debugger            │
  │  (★)   │                              │
  │        │  crash in parse() at         │
  │ push   │  src/parser.ts:142           │
  │ ────→  │  null ref on options.bracket │
  │        │                              │
  │        │  reads surrounding code      │
  │        │  runs git log src/parser.ts  │
  │        │  writes test to reproduce    │
  │        │  applies minimal fix         │
  │        │  runs test suite: 14/14 ✓    │
  │ pull   │                              │
  │ ←────  │  Debug report:               │
  │        │  Root cause: missing guard   │
  │        │  Fix: one null check         │
  │        │  Risk: low, same pattern     │
  │        │    used safely elsewhere     │
  └────────┴──────────────────────────────┘

  You: /herd-new debugger --role debugger
  You: /herd-push debugger --compact compact-for-debug \
       "crash in parse() at src/parser.ts:142 — passed null options"
  You: [wait for debugger to finish — roster dot goes green]
  You: /herd-pull debugger
  → Debug report in your editor. Read, verify, apply.
```

1. `/herd-new debugger --role debugger`
2. Describe the bug compactly in your own pane:
   `/herd-push debugger --compact compact-for-debug "crash in parse() at src/parser.ts:142"`
3. The compact template runs in your pane → your last message is a structured
   repro brief.
4. `/herd-push debugger` — review the brief in the editor, submit.
5. Watch the debugger in its pane (green dot = idle, amber = thinking,
   pulsing red = stuck). You can hop in and redirect if it goes off track.
6. When done, `/herd-pull debugger` gets the fix report.
7. If the fix branch was isolated: `/herd-merge debugger` (wraps `wt merge`).

**Why this works:** the debugger gets a focused repro brief, not your whole
session. You watch it work — no trust trap. The fix report references
path:line, so you can verify before merging.

---

## Recipe 4 — Prototype a feature (single isolated agent)

> Spawn in its own worktree, push the goal, pull the prototype, merge.

```
  ┌─────────────┬──────────────────────────────────────┐
  │  you (★)    │       prototyper (isolated)          │
  │             │  worktree: herd-my-pi/rate-limiter    │
  │             │  branch:   herd-my-pi/rate-limiter    │
  │  push goal  │                                      │
  │  ─────────→ │  explores design space               │
  │             │  chooses token-bucket approach        │
  │             │  implements src/rate-limiter.ts       │
  │             │  commits: 3 commits                   │
  │             │  writes prototype report              │
  │  pull       │                                      │
  │  ←───────── │  Report: approach, what works,       │
  │             │  limitations, next steps              │
  └─────────────┴──────────────────────────────────────┘

  You: /herd-new proto --role prototyper --isolate
  You: /herd-push proto --compact compact-for-prototype \
       "rate limiter — token bucket, 100 req/s, Redis backend"
  [Wait for proto to finish]
  You: /herd-pull proto
  → Prototype report. Review the branch: git log herd-my-pi/proto
  You: /herd-merge proto     # squash-merge + remove worktree
```

1. `/herd-new proto --role prototyper --isolate`
   - Creates `herd-my-pi/proto` branch + worktree via `wt switch -c -x`.
   - Proto runs in isolation — can't touch your main tree.
   - Roster shows the branch: `proto  ◐ dirty  branch herd-my-pi/proto`.
2. `/herd-push proto --compact compact-for-prototype "rate limiter…"`
3. Your agent distills the goal into the prototype template.
4. `/herd-push proto` sends it. Proto starts building.
5. Check progress: hop into proto's pane, or watch the roster (dirty = changed
   files, clean = committed).
6. `/herd-pull proto` brings back the prototype report.
7. Review the branch: `git log herd-my-pi/proto`.
8. If satisfied: `/herd-merge proto` (wraps `wt merge -y`).
   If not: `/herd-discard proto` (wraps `wt remove`).

**Why isolate:** the prototyper can make changes, commit, even break things —
your main tree is untouched. The roster shows the branch so you always know
which agent owns which work.

---

## Recipe 5 — Parallel-prototype and pick a winner

> Three approaches, three isolated agents. Compare, merge the best, discard
> the rest.

```
  ┌────────────────────────────────────────────────────────────┐
  │                     you (★ orchestrator)                    │
  │                                                            │
  │  /compact-for-variants "rate limiter"                      │
  │    → spawn plan: A=token-bucket, B=sliding-window,         │
  │                  C=Redis+Lua                               │
  │                                                            │
  │  Spawn all three:                                          │
  │  /herd-new rl-a --role prototyper --isolate                │
  │  /herd-new rl-b --role prototyper --isolate                │
  │  /herd-new rl-c --role prototyper --isolate                │
  │                                                            │
  ╞════════════════════════════════════════════════════════════╡
  │  ╭─ Herd ──────────────────────────────────────────────╮   │
  │  │ ▶ ★ ● you              clean                        │   │
  │  │     ● rl-a   🧠M  dirty  branch herd-my-pi/rl-a     │   │
  │  │     ● rl-b   🧠M  dirty  branch herd-my-pi/rl-b     │   │
  │  │     ● rl-c   🧠M  dirty  branch herd-my-pi/rl-c     │   │
  │  │                      ⊕ 3 unmerged                   │   │
  │  ╰─────────────────────────────────────────────────────╯   │
  ╞════════════════════════════════════════════════════════════╡
  │  Push each variant brief:                                  │
  │  /herd-push rl-a "Approach: token bucket, single process"  │
  │  /herd-push rl-b "Approach: sliding window, 1s granularity"│
  │  /herd-push rl-c "Approach: Redis + Lua atomic script"     │
  │                                                            │
  │  Wait for all three. Pull results:                         │
  │  /herd-pull rl-a; /herd-pull rl-b; /herd-pull rl-c        │
  │                                                            │
  │  You compare. Winner: rl-a (simplest, fastest, enough).    │
  │                                                            │
  │  /herd-merge rl-a                                          │
  │  /herd-discard rl-b                                        │
  │  /herd-discard rl-c                                        │
  ╘════════════════════════════════════════════════════════════╛
```

1. In your own pane: `/compact-for-variants rate limiter`
   - This is pi's native `/compact-for-variants` prompt template (not a herd
     command). Your agent replies with a spawn plan: a table of approaches,
     each with a branch name, one-line goal, and key files.
2. Spawn each variant:
   - `/herd-new rl-a --role prototyper --isolate`
   - `/herd-new rl-b --role prototyper --isolate`
   - `/herd-new rl-c --role prototyper --isolate`
3. Push each one its variant brief (edit your last message for each):
   - `/herd-push rl-a` (trim to just variant A's row)
   - `/herd-push rl-b`
   - `/herd-push rl-c`
4. Watch the roster. The `⊕ 3 unmerged` badge in the header reminds you these
   exist.
5. Pull results from each, compare.
6. Merge the winner: `/herd-merge rl-a`
7. Discard the losers: `/herd-discard rl-b`, `/herd-discard rl-c`
8. The `⊕ N` badge drops to 0.

**Why manual spawn:** no `/herd-variants` fan-out command. The human decides
how many variants and what each gets. The template scales thinking without
scaling machinery.

---

## Recipe 6 — Review my changes before commit

> Spawn a reviewer, push what changed, pull the review.

```
  ┌───────────────┬────────────────────────────────┐
  │  you (★)      │           reviewer             │
  │               │                                │
  │  you've made  │                                │
  │  changes in   │  reads diff                    │
  │  src/auth/    │  checks logic, style, tests    │
  │               │                                │
  │  push diff    │                                │
  │  ───────────→ │  finds:                        │
  │               │  - missing null guard (critical)│
  │               │  - inconsistent error handling │
  │               │  - no test for edge case       │
  │               │                                │
  │  pull review  │  Verdict: request changes      │
  │  ←─────────── │                                │
  │               │                                │
  │  You fix the  │                                │
  │  issues,      │                                │
  │  commit.      │                                │
  └───────────────┴────────────────────────────────┘

  You: /herd-new reviewer --role reviewer
  You: /herd-push reviewer --compact compact-for-review \
       "src/auth/ — refactored login flow"
  You: /herd-push reviewer
  [Reviewer reads diff, produces review]
  You: /herd-pull reviewer
  → Review in your editor. Address feedback, then close reviewer's pane.
```

1. `/herd-new reviewer --role reviewer`
2. `/herd-push reviewer --compact compact-for-review "src/auth/ login refactor"`
3. `/herd-push reviewer`
4. Reviewer reads the diff (it can use git commands since it shares the tree)
   and produces a structured review.
5. `/herd-pull reviewer` — the review arrives in your editor.
6. Address issues, re-run if needed.

**Why this works:** the reviewer role has `thinking: low` — it's fast and cheap.
It reads your actual diff (not a description of it). Issues are path:line
references, not vague observations.

---

## Recipe 7 — Managing an ongoing herd (day-to-day)

> The maintenance verbs — focus, hide, save, resume, sort.

```
  ╭─ Herd detail ───────────────────────────────────────╮
  │ ▶ ★ ● you                  clean              2s    │
  │   role: orchestrator                                │
  │   model: anthropic/claude-sonnet-4-20250514         │
  │       ● scout   🧠L     clean              5m      │
  │   role: explorer                                   │
  │       ● proto   🧠M  ⚠  dirty  herd-my-pi/proto   │
  │   role: prototyper                                 │
  │   ⚠ role expects isolation; running on shared tree  │
  │       ● old-bug       exited              4s       │
  │                       ⊕ 1 unmerged                  │
  ╰─────────────────────────────────────────────────────╯
```

### Pane switching
- `/herd-focus` — interactive overlay. `↑/↓` to pick, `Enter` to focus that
  pane. Faster than clicking or herdr keybindings when you have 5+ panes.

### Widget detail
- `/herd` cycles: `compact` (names + thinking badge + wt state) → `detail`
  (adds role + model) → `detailAll` (adds session path + warnings).
- Compact is good for daily use; detail when you need to check which model an
  agent is running.

### Noise control
- `/herd-hide old-bug` — suppresses a row. The pane stays open; only the roster
  drops it. Persists across sessions.
- `/herd-unhide old-bug` — brings it back.

### Attention management
- `/herd-stale` — flips sort order. Neglected agents at top. "What have I
  forgotten?" Toggle again for normal sort.

### Template save/resume
- `/herd-save scout-setup` — saves this pane's role + model + thinking + goal
  to `.pi/herd-my-pi/templates/scout-setup.json`.
- `/herd-new proto --template scout-setup` — spawn a new agent with those
  same settings. Or with `--isolate` for a worktree version.
- `/herd-resume` — lists all saved templates.
- `/herd-resume scout-setup` — re-spawn from a template.
- `/herd-resume` and `/herd-new --template` differ in *intent*:
  - `/herd-new --template` = "make a new agent shaped like this."
  - `/herd-resume` = "bring back that agent I saved earlier."

### Worktree lifecycle
- The `⊕ N unmerged` badge in the widget header is your cleanup reminder.
  It counts `herd-my-pi/*` branches with unmerged changes.
- `/herd-merge proto` — wrap `wt merge` (squash + rebase + delete worktree).
- `/herd-discard proto` — wrap `wt remove` (delete worktree + branch). Use when
  a prototype didn't pan out.

### Per-role isolate warnings
- If a role's frontmatter says `isolate: true` but you spawn without `--isolate`,
  you get a notification at spawn AND a persistent `⚠` on that row.
- The prototyper role ships with `isolate: true` — it expects its own worktree.
  Explorer and reviewer don't (they don't write code by default).

### Forcing a push mid-turn
- If an agent is stuck or you want to redirect it: `/herd-push scout --force`
- Sends `Escape` to interrupt, then delivers your message.

---

## Command reference (quick lookup)

| Command | What |
|---|---|
| `/herd` | Toggle roster (off → compact → detail → detailAll → off) |
| `/herd-init [--force]` | Scaffold prompts, agents, config |
| `/herd-new <name> [--role R] [--isolate] [--template T]` | Spawn agent |
| `/herd-new` | Spawn with interactive form (sequential prompts) |
| `/herd-focus` | Interactive pane picker overlay |
| `/herd-push <name> [--force] [--compact T [focus]]` | Ferry your last message |
| `/herd-pull <name> [--edit]` | Ferry target's last message into your input |
| `/herd-save <name>` | Save current agent shape as template |
| `/herd-resume [name]` | List or re-spawn from a template |
| `/herd-hide <name>` | Suppress from roster |
| `/herd-unhide <name>` | Restore to roster |
| `/herd-stale` | Toggle stale-first sort |
| `/herd-merge <name>` | Merge isolated agent's worktree (wt merge) |
| `/herd-discard <name>` | Discard isolated agent's worktree (wt remove) |

## Config reference

Edit `.pi/herd-my-pi/config.json` (scaffolded by `/herd-init`):

```jsonc
{
  "glyphs": {
    "agentFilled": "◆",    // tab icon
    "agentOutline": "◇",   // pane icon
    "current": "▶",        // current pane marker
    "main": "★"            // orchestrator marker
  },
  "staleness": {
    "amberMs": 120000,     // green → amber at 2m
    "redMs": 600000,       // amber → red at 10m
    "pulseMs": 1800000,    // red → pulse at 30m
    "pulseStyle": "pulse"  // "pulse" or "dim"
  },
  "intervals": {
    "heartbeatMs": 2000,
    "widgetRefreshMs": 1000,
    "closedPaneLingerMs": 5000
  },
  "spawn": {
    "defaultDirection": "right",  // "right" or "down"
    "collisionPolicy": "error"    // "error" or "auto-suffix"
  },
  "worktrees": {
    "autoDiscardOnClose": false,
    "branchPrefix": "herd-my-pi/"
  },
  "widget": {
    "showDetail": false,
    "staleFirst": false
  },
  "hidden": {
    "paneIds": []
  }
}
```

## Role agents

Shipped with the package, scaffolded by `/herd-init` into `.pi/agents/`:

| Role | Model | Thinking | Isolate | What it does |
|---|---|---|---|---|
| `explorer` | claude-sonnet-4 | low | no | Read-only reconnaissance |
| `debugger` | claude-sonnet-4 | medium | no | Reproduce → isolate → fix → verify |
| `prototyper` | claude-sonnet-4 | medium | **yes** | Design space exploration + implementation |
| `reviewer` | claude-sonnet-4 | low | no | Read-only code review |

Edit `.pi/agents/*.md` to change models, thinking levels, or add `isolate:
true`/`isolate: false`. Add new `.md` files to create custom roles — they appear
in the `/herd-new --role` dropdown automatically.

## Compact templates

Shipped with the package, scaffolded by `/herd-init` into `.pi/prompts/`:

| Template | When to use |
|---|---|
| `compact-for-exploration` | Map an unknown code area |
| `compact-for-debug` | Reproduce and fix a bug |
| `compact-for-prototype` | Design and build a feature |
| `compact-for-review` | Review a set of changes |
| `compact-for-handoff` | Generic context transfer (any topic) |
| `compact-for-variants` | Plan parallel approaches |

All accept a `$1` focus argument. Use with `/herd-push --compact <template> <focus>`
or run directly as `/compact-for-exploration <focus>`.
