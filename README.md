# herd-my-pi

Start a herd of interactive pi sub-agents from templates. Each runs in its own
[Herdr](https://herdr.dev) tab through herdr-core (`hc`), nested under the pi
that started it. Hop into any of them to steer, stop, or answer their
questions; they talk to each other with `hc`.

## Requirements

- pi, running inside a herdr-core terminal (`$HC_TERMINAL_ID` set)
- The Herdr desktop app, for tabs and the sidebar (without it, agents run as
  hidden sub-agents of your terminal)

## Install

```sh
pi install /path/to/herd-my-pi       # everywhere
pi install -l /path/to/herd-my-pi    # this project only
```

## Use

```
/herd             pick agents (space toggles, enter starts)
/herd --outlive   same, but they keep running after this pi ends
```

`/herd` renames your tab to **Orchestrator**, then reads agents from
`.pi/extensions/herd-my-pi/agents/*.md` in the project. If the project has
none, it offers to copy the shipped agents there so you can edit and commit
them; declining uses the shipped ones as they are.

Each agent starts as `pi --model … --thinking …` with the template body
appended to its system prompt, labelled `herd.parent=<orchestrator>` and
`herd.role=<template>`. The orchestrator gets a message listing its herd.

## Agent templates

```md
---
name: reviewer
description: Read-only code reviewer
model: claude-bridge/claude-opus-5-5   # optional, any pi --model pattern
thinking: high                          # optional
---
You are the herd's reviewer. …
```

## How agents talk

The bundled `herd-my-pi` skill teaches every herd member the conventions:
find the herd with `hc ls --label herd.parent=<orchestrator>`, message with
`hc send`, report to the orchestrator when done or stuck, and ask the person
in their own session when a decision is theirs.
