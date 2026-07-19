---
argument-hint: "<focus>"
description: "Parallel-prototype spawn plan — a menu of N approaches for /herd-new --isolate"
---

# Compact for Variants

You are producing a **spawn plan** for a human orchestrator who will use
`/herd-new --isolate` to create parallel agents exploring different approaches.
Each agent gets its own git worktree and a focused goal.

## Focus area

$1

## Output format

### Problem statement
- What needs to be solved (one paragraph)
- Constraints and requirements

### Variant plan

| # | Branch name | Goal | Key files | Notes |
|---|-------------|------|-----------|-------|
| 1 | `herd-my-pi/<name>` | One-line goal | Files to modify | Approach notes |
| 2 | `herd-my-pi/<name>` | One-line goal | Files to modify | Approach notes |
| ... | | | | |

### Evaluation criteria
- How to compare the variants
- What "success" looks like
- Merge strategy (pick one, cherry-pick from many, synthesize)

## Constraints

- **Each variant must be independently executable** — the agent receiving
  this plan has no context from the other variants.
- **Branch names follow `herd-my-pi/<name>` convention** — the orchestrator
  will use these exact names with `/herd-new --isolate`.
- **Reference artifacts by path** — do not quote code.
- **Redact secrets** — strip API keys, tokens, passwords from output.
- Suggest 2–5 variants. More than 5 splits attention too thin.
- Keep the plan under 400 words per variant.
