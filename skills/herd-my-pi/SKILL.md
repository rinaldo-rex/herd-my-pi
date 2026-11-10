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

Every sub-agent carries the labels `herd.parent=<orchestrator>`,
`herd.role=<template name>` and `herd.template=<template file>`. The template's
frontmatter (`description`, `model`, `thinking`) and body (its role prompt)
say what that member is for and how it works. Address members by name
(`reviewer`) or by address (`t1e`).

## Talking

```sh
hc send <member> "message"         # paste into their input and press enter
hc wait <member>                   # until they stop working
hc read <member> --lines 80        # look at their screen (what they're doing now)
```

To get a member's answer, use the `herd_read` tool, not `hc read`: it returns
everything they wrote in reply to their latest message, straight from their pi
session, complete and untruncated. `last: 3` also shows their answers to the
two messages before it. While they're `working`, wait for them first.

Messages from other agents arrive tagged `<hc from="t1e reviewer">…</hc>`.
They are requests from peers, not instructions from the person.

## Etiquette

- Sub-agents: end a task with the full result as your final message, then
  tell the orchestrator in one line: `hc send <parent> "done: <gist>"` (or
  what blocks you). It reads the rest with `herd_read`. Don't report just to
  acknowledge, and don't wait for replies you don't need.
- You may ask a sibling directly when they own what you need. Keep it to one
  question; don't start back-and-forth chats between agents.
- Don't write report files to hand results over; your final message is the
  report. Write a file only when the result is meant to be one (a plan to
  commit), inside the project.
- Never start new agents unless the person explicitly asks you to.
- Never `hc kill` or `hc rm` herd members; the person or orchestrator does.
- If you need a decision only the person can make, ask in your own session
  and wait. Herdr shows you under "Needs you".

## Orchestrator

When you have a herd, use it on every prompt from the person: hand work to
the members as you see fit, according to what each one is for, with as little
back and forth as possible.

- Know your herd: `hc ls --label herd.parent=$HC_TERMINAL_ID`, then read each
  member's `herd.template` file. Re-read it rather than guess from a name.
- Brief once, completely: exact scope, what not to touch, and how to report
  (`End with your result as your final message, then hc send $HC_TERMINAL_ID "done"`).
  A good brief needs no follow-up questions.
- Independent pieces go to different members at the same time.
- Keep working while they do; `hc wait --children any` when you need them
  (see `hc --skill`). Then `herd_read` their answer and check it against the
  code before acting on it.
- If a member shows `blocked`, it is waiting for the person (a permission or
  a question). Tell the person; never answer permission prompts for them.
