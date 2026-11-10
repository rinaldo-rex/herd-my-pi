# herd-my-pi

Start a herd of **interactive pi agents**, each in its own [Herdr](https://herdr.dev)
tab. Review their work, hop into a member to steer it, and let the agents talk
through herdr-core (`hc`). Every member is a normal pi session—not an opaque
background tool.

**Status:** early-stage, version 0.2.0. Review changes before using this on
valuable work. See [limitations](#limitations-and-safety) and the
[changelog](CHANGELOG.md).

## Requirements

- [Pi](https://pi.dev), with at least one configured model/provider. Development
  dependencies are pinned to pi **1.5.2**; compatibility with other versions is
  not guaranteed.
- [herdr-core](https://herdr.dev), with `hc` on `PATH`, and pi running inside an
  hc terminal (`HC_TERMINAL_ID` set). The current integration targets
  **hc 0.1.19**.
- The Herdr desktop app (**0.1.14** is the current integration target) for tabs
  and the sidebar. Without it, members still run as terminals under your pi,
  but no desktop tabs appear.
- **Node.js 24.x**, matching `engines` in [package.json](package.json).
  This package's development setup uses **pnpm 12.18.0**; using an installed
  package does not require a separate project dependency install.

Use herdr-core's `hc`, **not the older `herdr` CLI**. Agents need the `pi`
executable on `PATH` and access to their selected model's credentials. The launch
wrapper uses the POSIX `env` executable; native Windows support is not verified.
Automated CI targets Linux.

## Install

Install globally so all pi sessions can load the extension and bundled skill:

```sh
pi install git:github.com/rinaldo-rex/herd-my-pi
```

For a local checkout, or a project-only installation:

```sh
pi install /absolute/path/to/herd-my-pi
pi install -l git:github.com/rinaldo-rex/herd-my-pi
```

Restart pi or run `/reload` after installation. Project-only packages require
project trust; review the package and project templates before granting it.
There is no npm release assumed by these instructions.

## Five-minute quickstart

1. In a Herdr terminal, open your working directory and start `pi`.
2. Run `/herd` in pi's input.
3. If prompted, copy the bundled agent templates into the project so you can
   customize them. Declining uses the shipped templates without copying.
4. Use **↑/↓** to move and **space** to select members. **Tab** opens pi's model
   picker; choose a model you can use. **Shift+Tab** cycles thinking levels.
   Press **Enter** to start, or **Esc** to cancel.
5. Ask the orchestrator for a task, for example:

   > Have the explorer map the authentication code, then ask the reviewer to
   > identify risks. Keep both read-only and summarize their findings.

The orchestrator receives the members' names, addresses, and template paths.
It can delegate through `hc send`, wait through `hc wait`, and read full replies
with `herd_read`. You can visit a member's tab to ask a question or change course.
The person's messages take priority.

### Example session

```text
You: /herd
     Select explorer and reviewer → choose available models → Enter

Herdr tabs: Orchestrator | explorer | reviewer

You: Ask the explorer to map src/ and the reviewer to inspect error handling.
     Don't change files. Summarize both reports.
```

This is an illustrative walkthrough, not a captured run. Member names receive
suffixes when another live terminal already has the same name.

## Commands and lifecycle

| Command or control | Purpose |
| --- | --- |
| `/herd` | Pick and start members; they end when this pi's hc terminal ends. |
| `/herd --outlive` | Start members that keep running after the parent terminal ends. |
| Space / `a` | Toggle one member / all members in the picker. |
| Tab / Shift+Tab | Select a model / cycle thinking levels. |
| `herd_read` tool | Read a member's latest replies from its pi session. |

`herd_read` takes `member` (a local hc name or address). By default it checks
only the **latest prompt**, including a pending prompt with no answer; it never
silently substitutes an older report. The result identifies `latestPromptId`
and its readiness:

- `ready`: the latest persisted prompt has a complete report and the runner is
  no longer working. This means available to review, **not that the task passed**.
- `not_ready` / `incomplete`: wait for completion or address the reported failure;
  do not accept a previous answer as the current task's result.
- `history`: explicitly requested older replies, not a current-result check.
- `blocked`: **“Noted, waiting on user”**, without inspecting the session file.
  Never call the tool to investigate a member already known to be blocked.

For a reused member, retain its previous `latestPromptId` and pass it as `after`
when collecting the next task. A new result must come from a newer prompt on
that active branch. This also guards the gap before a newly sent prompt reaches
the session file; without a cursor, a read cannot detect an unpersisted request.
Use optional `last` (1–10) only for chronological **history**; `after` and `last`
cannot be combined. Match the final report's task ID/snapshot to your assignment.

The tool reads assistant text, not the terminal screen, thinking blocks, or tool
output. Results are limited to 50 KiB or 2,000 lines; longer output is saved in
full to a private temporary file whose path is returned. Remote
`machine/address` targets are not supported.

The bundled [skill](skills/herd-my-pi/SKILL.md) documents delegation conventions.
For manual inspection, run `hc ls`, `hc get <member>`, or `hc read <member>` in a
shell. Stopping a member uses `hc kill <address>`; check the address and save
work first. Outliving members need explicit cleanup and may continue consuming
provider quota.

## Delegate without babysitting

Give each member a short state card instead of relying on scattered chat history:

```text
Task: parser-1 — fix the quoted-argument edge case
Own: src/parser.ts and tests/parser.test.ts; no other files
Settled: keep existing API; Node 24; no new dependencies
Environment: run subprocesses with the project's PATH
Acceptance: targeted parser tests pass; no live agents started
Checks: implementer tests while editing; reviewer checks the final frozen diff
Report: task ID, observed snapshot, result, checks actually run, limitations
```

Parallel members share files, not just context: assign non-overlapping ownership.
Give the reviewer a stable diff/file-content snapshot, not only a commit hash
when the worktree contains uncommitted edits. Recheck affected behavior after
subsequent changes rather than repeatedly running every check on moving files.

Members finish their tools/checks and put their full result in the final
response. An agent-written “done” is not a completion signal: wait for hc's
completed turn, then collect the matching result. A wait interrupted by a
message is not completion.

When a member is blocked, the orchestrator says **“Noted, waiting on user”** and
does not inspect, diagnose, message, or unblock it. The person handles that
member directly. This does not remove permission controls or forbid genuine
requirements questions.

See the [workflow experiment record](https://github.com/rinaldo-rex/herd-my-pi/blob/main/experiments/workflow.md)
for tested reader guarantees, the live-pilot protocol, and limits of the evidence.

## Customize agent templates

Project templates live at `.pi/extensions/herd-my-pi/agents/*.md`. If that
directory exists, it replaces the shipped template set. Commit project
roles deliberately; this repository ignores its own local `.pi/` directory.

```md
---
name: reviewer
description: Read-only code reviewer
thinking: high
---
You review the files you are given. Do not edit files.
Verify findings against the code and cite path:line.
```

`name` defaults to the filename; `description`, `model`, and `thinking` are
optional. The Markdown body is appended to the member's system prompt. To pin a
model, add `model: provider/model-id` using an identifier available in your pi
setup, or select one with Tab. Without a model, the member uses pi's default—not
necessarily the orchestrator's current model. Picker overrides apply to that
launch; they do not rewrite the template.

The bundled explorer, implementer, and reviewer omit model pins so they work
with your configured pi default. Existing project templates are not overwritten.

Only copy templates from sources you trust. See [SECURITY.md](SECURITY.md).

## Limitations and safety

- **Members share the project working directory.** There is no built-in
  worktree isolation, merge/discard command, or protection from concurrent edits.
  Assign non-overlapping files or arrange separate worktrees yourself.
- “Read-only” in a role is an instruction, **not a sandbox or enforced permission**.
  Members have the tools and permissions configured in their pi environment.
- `herd_read` reads local session files published through terminal labels. It
  is not a security boundary between local agents. Avoid secrets in prompts,
  session transcripts, screenshots, and bug reports.
- Running more agents can increase token costs and provider rate-limit pressure.
- Desktop tab adoption and interactive model selection need manual integration
  testing. Automated tests do not prove every external CLI or provider works.
- Only the current implementation is supported; older `/herd-*` commands from
  the previous design are not part of version 0.2.0.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `/herd` is missing | Run `pi list`, confirm installation scope/project trust, then restart or `/reload`. |
| “needs to run inside … hc” | Start pi inside a herdr-core terminal; inspect `HC_TERMINAL_ID`. |
| Model unavailable or authentication failure | Use Tab to choose an available model; configure that provider in pi. |
| No desktop tab appears | Check Herdr is running, `herdr-app` is on `PATH`, and the parent terminal belongs to a Herdr space. Inspect the member with `hc get`. |
| No templates appear | Check the project agent directory contains valid `.md` templates. An existing empty directory does not fall back to bundled roles. |
| `herd_read` has no session or no answers | Check that member loaded the package and has received a prompt. `--no-session` disables persisted replies; an exited member may never have answered. |

## Update and uninstall

Use `pi update --extensions` to reconcile package installations. To uninstall,
remove the same source and scope you installed, then restart or `/reload`:

```sh
pi remove git:github.com/rinaldo-rex/herd-my-pi
# For a project-only install:
pi remove -l git:github.com/rinaldo-rex/herd-my-pi
```

For a local installation, substitute its absolute path. Removal does not erase
copied project templates or stop already-running members; manage those explicitly.

## Development and reporting

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, checks, packaging, and a manual
smoke test. File reproducible bugs through [GitHub issues](https://github.com/rinaldo-rex/herd-my-pi/issues).
Report security problems privately as described in [SECURITY.md](SECURITY.md).

[MIT licensed](LICENSE).
