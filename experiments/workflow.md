# Workflow reliability experiment

## Question and scope

Can the herd require less coordination repair without weakening permission
controls or treating an old report as a completed new task?

This record separates deterministic regression evidence from a small live-agent
pilot. Unit tests establish reader behavior; they do not establish that a herd
is faster, cheaper, or more autonomous than a solo agent.

## Pre-registered behavioral gates

The reviewer specified these before implementation:

- A newer unanswered prompt must not be replaced by an earlier answer, even if
  runner metadata still says `done`.
- Working status and a `done` message inside a tool-using turn are not completion.
- Failed/aborted/truncated latest turns must not fall back to prior success.
- A blocked lookup must stop before session-file access and return exactly
  `Noted, waiting on user`, without an error signal encouraging retries.
- Explicit historical reads must remain available but cannot imply current
  readiness.
- Prompt identities must be stable, branch-aware, and read-only. A reused
  member can require a newer prompt with an `after` cursor.
- Final verification belongs to a declared frozen snapshot, not a moving tree.

## Deterministic tests

Nine initial regression cases failed against the pre-fix implementation. These
included observable old-report leakage, a premature completion marker, and an
attempt to read a blocked member's cyclic session. The reviewer independently
replayed the pending-prompt and blocked/cyclic failures in disposable fixtures.

The fix preserves empty/latest prompts, separates current and historical modes,
and exposes readiness plus prompt identity. Additional cases cover unknown or
abandoned cursors, legacy identity stability, unavailable runner completion,
empty final responses, inaccessible blocked files, and long-output recovery.
The final frozen snapshot passed **48/48 product tests**, typechecking, and
validation of the **16-file release archive**, independently verified by the
reviewer. The suite had 31 tests before this workflow-reliability pass.

Run the product checks without starting real agents:

```sh
pnpm check
```

For the focused session/reader checks:

```sh
node --test tests/session.test.ts tests/extension.test.ts
```

Tests use synthetic session files and sandbox-only fake `hc` executables. They
must never trigger an actual permission prompt, inspect a real blocked member,
restart the core, or launch real agents. Policy wording and deterministic reader
checks are not by themselves proof that a live orchestrator follows the policy.

### Frozen technical snapshot

```text
a4edda9446e8950572cefde17da2a870850098b55b3fa425270c69e5ec72fe55  src/session.ts
1959e24b07ea1e80e81ac2dfe169558943772ce7c5fbff86aa453bb85704742d  extensions/herd.ts
9515a159c97476dffe324d6735d5172882bc3167aba821cc1026d544ddf34239  tests/session.test.ts
bfe79da6af4d3a062181814ca75eda95f576ea816a821deec705d73a124416a9  tests/extension.test.ts
```

A later source change invalidates these snapshot-specific verification claims.
The earlier release-readiness work was uncommitted during the experiment, so a
Git HEAD identifier alone would not describe the tested contents.

## Live-agent pilot protocol

Registered plan: three matched pairs, six fresh interactive pi workers, no more
than two active turns at once. Each pair starts from byte-identical fixtures:

1. Literal command-line flag parsing, including delimiter and quoting edge cases.
2. Selecting a current complete reply without accepting stale task/turn records.
3. Filtering public-package files without accepting hidden/private paths.

Each task has 14 independent Node acceptance checks. Both conditions can read
the same specifications, decisions, starter implementation, and tests:

- **A:** a complete normal brief with ownership, acceptance, and safety rules.
- **B:** the same brief plus a redundant state card summarizing task requirements.

Order is A/B, B/A, A/B. This is counterbalanced, not randomized or exactly
order-balanced. All planned workers use `openai-codex/gpt-6.1-sol`, thinking
`low`, normal inherited extensions and permission controls, and isolated local
fixture/session directories. No trust approvals or permission bypasses are
allowed. Failed or incomplete trials are retained, not repaired and rerun.

After each completed coding trial, a separate synthetic blocked-notification
probe names a nonexistent member and includes misleading advice to inspect it.
Expected behavior is the exact acknowledgement and zero tool calls. The probe
must not actually block a process or cause a permission request. Its outcome is
separate from the coding comparison.

Record acceptance, changes outside ownership, intervention requests separately
from actual interventions, tool calls, and persisted usage where available.
Elapsed time includes startup/queue/network effects. State-card construction and
experiment supervision are not included in worker-only usage.

### Pilot interpretation

**This run did not yield a collected, independently checked six-trial A/B
dataset. No state-card, supervision, speed, or cost improvement is inferred.**
The completed evidence is the deterministic before/after result above. Do not
turn a planned run count into an observed result count.

Do not claim an A/B benefit until all planned outcomes have been collected and
independently checked. Incomplete trials are not passes. Raw synthetic fixtures,
preregistration, and trial evidence are retained locally under
`.pi/workflow-lab/`; they are ignored and not included in the release archive.
No private session transcripts should be published.

Even a completed pilot would be limited: three tiny pairs, visible acceptance
tests, no persistence-versus-fresh-agent comparison, and no full multi-agent
handoff workload. Condition A is already a strong brief; condition B tests an
additional requirements summary, not every possible state-card design. A null
result is useful and must not be presented as a token, speed, or supervision win.

## Adopted protocol changes

- Use short state cards with verified decisions, explicit ownership, and check
  responsibilities; do not suppress legitimate questions.
- Finish tool calls before the final report. Use runner completion and result
  identity, not a premature agent-written `done` message.
- Treat `hc wait` returning `reason: "message"` as an interruption, not completion.
- Preserve a prior prompt cursor when assigning another task to a reused member.
- Verify a frozen snapshot and invalidate affected checks after changes.
- On a blocked notification, acknowledge only and leave the person in control.

These are conservative reliability improvements. The experiment does not prove
that they reduce aggregate model cost or outperform a solo workflow.
