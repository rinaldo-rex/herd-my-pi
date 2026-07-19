---
argument-hint: "<focus>"
description: "Reconnaissance briefing — files, patterns, conventions, entry points"
---

# Compact for Exploration

You are producing a **reconnaissance briefing** for a human orchestrator who
will relay it to another agent. The briefing must be self-contained: the
receiving agent has no prior context.

## Focus area

$1

## Output format

### Scope
- What was examined (files, directories, modules, config)
- What was deliberately skipped and why

### Findings
- Key files and their roles (reference by **path**, do not quote contents)
- Patterns, conventions, and naming schemes observed
- Entry points and public interfaces
- Dependencies and integration points

### Open questions
- Anything ambiguous, contradictory, or worth deeper investigation
- Potential gotchas for someone about to modify this area

## Constraints

- **Reference artifacts by path** — do not duplicate file contents; the
  receiving agent can read them directly.
- **Redact secrets** — strip API keys, tokens, passwords, and credentials
  from any output. Replace with `<REDACTED>`.
- Keep the briefing under 500 words. Dense > comprehensive.
