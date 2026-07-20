---
argument-hint: "<focus>"
description: "Generic handoff — context, progress, next steps, blockers"
autocomplete-hint: "compact-for-handoff <focus-area>"
---

# Compact for Handoff

You are producing a **handoff brief** for a human orchestrator who will relay
it to another agent. The receiving agent has no prior context — give them
everything they need to continue your work.

## Focus area

$1

## Output format

### Context
- What you were working on and why
- Key decisions made and their rationale

### Progress
- What's done (reference artifacts by **path**)
- What's in progress
- What's blocked (and why)

### Next steps
- Immediate action items (numbered, specific)
- Files to touch and what to change
- Tests to run or write

### Blockers
- Anything preventing progress
- Dependencies on external factors

## Constraints

- **Reference artifacts by path** — do not quote code; the receiving agent
  can read files directly.
- **Redact secrets** — strip API keys, tokens, passwords from output.
- Keep the brief under 500 words. Actionable > descriptive.
