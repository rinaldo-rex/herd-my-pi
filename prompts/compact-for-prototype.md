---
argument-hint: "<focus>"
description: "Design-options brief — approaches with tradeoffs, no implementation"
autocomplete-hint: "compact-for-prototype <focus-area>"
---

# Compact for Prototype

You are producing a **design-options brief** for a human orchestrator who will
relay it to another agent (or spawn multiple agents to explore alternatives in
parallel). The receiving agent has no prior context.

## Focus area

$1

## Output format

### Problem statement
- One paragraph: what needs to be built or solved
- Constraints (technical, performance, compatibility)

### Approaches
For each viable approach:

**Approach N: <name>**
- How it works (2–3 sentences)
- Pros
- Cons
- Estimated complexity (small / medium / large)
- Key files that would change (by **path**)

### Recommendation
- Which approach you'd pick and why
- What would change your mind

## Constraints

- **Reference artifacts by path** — do not quote implementations.
- **Redact secrets** — strip API keys, tokens, passwords from output.
- No implementation code — this is a design brief, not a patch.
- Keep it under 600 words. Tradeoffs > details.
