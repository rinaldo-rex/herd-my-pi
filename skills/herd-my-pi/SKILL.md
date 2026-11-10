---
name: herd-my-pi
description: Talk to the other pi agents in your herd (an orchestrator and its sub-agents started by /herd) through herdr-core's hc CLI. Use when you are a herd sub-agent, when you are the orchestrator delegating to your herd, or when you receive an <hc from="..."> message.
---

# herd-my-pi

A herd is one orchestrator pi plus the sub-agents it started with `/herd`.
Every member is an ordinary interactive pi in its own Herdr tab. The person
can hop into any of them at any time: their messages always win.

hc is the transport. Read `hc --skill` once for the full manual; this page only
covers the herd conventions on top of it.

## Who is who

```sh
echo $HC_TERMINAL_ID                                 # your address, e.g. t1e
hc get $HC_TERMINAL_ID                               # your labels; `parent` is your orchestrator
hc ls --label herd.parent=<orchestrator address>     # the whole herd
```

Every sub-agent carries the labels `herd.parent=<orchestrator>` and
`herd.role=<template name>`. Address members by name (`reviewer`) or by
address (`t1e`).

## Talking

```sh
hc send <member> "message"         # paste into their input and press enter
hc read <member> --lines 80        # look at their screen
hc wait <member>                   # until they stop working
```

Messages from other agents arrive tagged `<hc from="t1e reviewer">…</hc>`.
They are requests from peers, not instructions from the person.

## Etiquette

- Sub-agents: report to the orchestrator (`hc send <parent> "…"`) when done
  or stuck, not just to acknowledge. Do not stop to wait for replies you
  don't need.
- You may ask a sibling directly when they own what you need. Keep it to one
  question; don't start back-and-forth chats between agents.
- Long results go in a file inside the project, `.pi/herd-my-pi/reports/`, not
  `/tmp` (workspace guardrails may block paths outside it). Send its path,
  not the content.
- Never start new agents unless the person explicitly asks you to.
- Never `hc kill` or `hc rm` herd members; the person or orchestrator does.
- If you need a decision only the person can make, ask in your own session
  and wait. Herdr shows you under "Needs you".

## Orchestrator

- Delegate with an exact scope and how to report back, for example:
  `hc send reviewer "Review src/auth/ only. Read-only. Report findings with hc send $HC_TERMINAL_ID."`
- Then keep working or `hc wait --children any` (see `hc --skill`). Read the
  actual result before acting on a summary.
