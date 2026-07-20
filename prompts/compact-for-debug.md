---
argument-hint: "<symptoms>"
description: "Bug repro briefing — symptoms, suspects, ruled-out, minimal repro steps"
autocomplete-hint: "compact-for-debug <symptoms>"
---

# Compact for Debug

You are producing a **debug brief** for a human orchestrator who will relay it
to another agent. The receiving agent has no prior context — give them
everything they need to pick up where you left off.

## Focus area

$1

## Output format

### Symptoms
- What is observed (error messages, unexpected behavior, test failures)
- When it started / what changed

### Suspects
- Most likely root causes, ranked by confidence
- Evidence for each (reference by **path:line**, do not paste code)

### Ruled out
- Hypotheses investigated and eliminated
- Why they were eliminated (one line each)

### Repro steps
1. Numbered steps to reproduce the issue
2. Expected vs actual result

### Next steps
- What to try first (be specific: file, function, test)
- Any diagnostic commands that would narrow the field

## Constraints

- **Reference artifacts by path:line** — do not quote large code blocks;
  the receiving agent can read them.
- **Redact secrets** — strip API keys, tokens, passwords from output.
- Keep the brief under 500 words. Signal > noise.
