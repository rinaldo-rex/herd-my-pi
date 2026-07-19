---
argument-hint: "<focus>"
description: "Review request — what changed, what to verify, artifact references"
---

# Compact for Review

You are producing a **review request** for a human orchestrator who will relay
it to another agent. The receiving agent will verify your work against the
artifacts — give them the context to do it efficiently.

## Focus area

$1

## Output format

### What changed
- Summary of modifications (reference by **path:line** where possible)
- Why each change was made (link to requirement, bug, or design decision)

### What to verify
- Specific checks: behavior, edge cases, integration points
- Tests to run or write
- Any manual verification steps

### Risk areas
- Parts most likely to have unintended side effects
- Known limitations or TODOs left in the code

### Context
- Related files that were read but NOT modified
- Assumptions made (and where to verify them)

## Constraints

- **Reference artifacts by path:line** — the receiving agent can read them
  directly.
- **Redact secrets** — strip API keys, tokens, passwords from output.
- Focus on what to verify, not on selling the changes.
- Keep it under 500 words. Precise > thorough.
