# Design Decisions — herd-my-pi

ADR-style record of the choices made during brainstorming, with the options
considered and the rationale for each. Ordered by the order they were settled.

References: [philosophy.md](./philosophy.md) · [brainstorm_v1.md](./brainstorm_v1.md)

---

## D1. Orchestration model — human only

**Decision:** The human is the sole orchestrator in v1. No agent spawns or
steers other agents.

**Options considered:**
- *Human only.* Pure "tmux for agents"; human spawns, hops, pushes, pulls.
- *Human + lead agent.* A coordinator agent can herd others, with human
  override.
- *Human, but agents can pull cooperatively.* Any agent can request context
  from a peer via a tool.

**Rationale:** Automation before the manual flow is understood leads to
"useless additions, deviation from required features, and hard redesigns"
(per the brainstorm). The whole differentiation is human control; automating
it away prematurely undermines the thesis. Cooperative pull and lead-agent
mode are parked as Phase-3 escapes.

---

## D2. Agent lifetime — ephemeral at runtime, templates saveable

**Decision:** Agents are ephemeral (closing the pane destroys the runtime
agent), but `/herd-new`/`/herd-save` can save a named **template**
(model + thinking + role + goal) to disk to re-instantiate later.
`/herd-resume <name>` is a future command in this family.

**Options considered:**
- *Ephemeral, pane = agent.* Close tab → gone.
- *Named + resumable.* Identity survives pi restart, backed by session JSONL.
- *Ephemeral, but templates.* Runtime is ephemeral; named templates on disk.

**Rationale:** Ephemeral matches "multi-pane interactive" cleanly and avoids
duplicating pi's own session/resume machinery. Templates capture the reusable
part (persona + model + goal) without the runtime baggage. Full resume is a
Phase-2 add once templates exist.

---

## D3. Push/pull symmetry — last assistant message, mirrored

**Decision:**
- `/herd-pull X` → take **X's last assistant message** → inject as **my** next
  input (default: direct inject; `--edit` opens a pre-filled widget).
- `/herd-push X` → take **MY last assistant message** (pre-filled, editable)
  → inject as **X's** next input.
- Edit affordance is a **flag (`--edit`)** on both, not separate commands.

**Options considered (push payload):** instruction-only; instruction + model
override; instruction + thinking; artifact reference. → Final: instruction
only (see D6 — model/thinking moved to `/herd-new`).

**Options considered (pull source):** last message; last full turn (q+a);
generated summary; raw screen tail to clipboard. → Final: last assistant
message into my input, editable via `--edit`.

**Options considered (edit affordance):** `--edit` flag vs separate
`/herd-pull-edit` command. → Final: flag.

**Rationale:** Push and pull are mirror images — same implementation (read a
pane's last assistant message in-process, drop it into another pane's input as
a base64 extension command over `herdr pane run`). Pre-filling the push box
with *my own* last message means the "what to push" field is never blank — it's
just the courier for whatever the source agent last said (often the output of a
`compact-for-*` template run upstream). The flag over a separate command avoids
4→8 command explosion; edit is a *modifier* on a verb, not a verb itself.
Default pull = direct inject for speed; `--edit` when you want to trim/annotate.

---

## D4. Compaction prompt templates — 5 templates, run on the SOURCE before push

**Decision:** Ship five `compact-for-*` prompt templates in v1 (Phase 1), run on
the **source** agent before push to shape its last message. They reference
artifacts by path (don't duplicate), redact secrets, and tailor to a `$1` focus.

Templates:
- `compact-for-exploration` — reconnaissance briefing (files, patterns,
  conventions, entry points).
- `compact-for-debug` — repro brief (symptoms, suspects, ruled-out, repro).
- `compact-for-prototype` — design-options brief (approaches + tradeoffs, no
  implementation).
- `compact-for-review` — review-request (what changed, verify against
  artifacts). Maps to postmortem fix #1 (trust trap).
- `compact-for-handoff` — generic, argument-driven (the mattpocock pattern).

**Options considered:** ship none (user-authored only); ship the four named;
ship four + the umbrella handoff.

**Rationale:** Research (`mattpocock/skills` handoff, `iTofu/handoff-skills`,
`0xBigBoss` handoff command) shows the "handoff" prompt pattern is a
well-established genre — herd-my-pi's templates are purpose-specialized
handoffs. The umbrella `compact-for-handoff` covers the "none of the above
fit" case. The two structural principles (reference artifacts by path → kills
context bleed; redact secrets) come straight from the canonical handoff skill.
Templates are cheap (`.md` files in `prompts/`) and demonstrate the
brain/plumbing split in v1.

---

## D5. Widget v1 — display-only, current-agent highlighted

**Decision:** Phase-1 roster widget is **display-only** (no row selection), but
it **highlights the currently-focused pane/tab** (read via `herdr pane current`
on each refresh). `/herd-new` auto-enables the widget toggle in the spawned
child. Interactive selectable rows (focus a pane by picking its row) land in
Phase 2.

**Options considered:** display-only in v1; selectable from v1.

**Rationale:** Display-only is the smallest widget that proves the concept (a
human co-driving multiple persistent panes with a live roster). Selectable rows
are high-leverage UX but not needed to validate the loop; deferring keeps the
MVP honest. "Highlight current" is essentially free (one `herdr pane current`
call per refresh) and immediately useful — you always know which pane you're in.

---

## D6. Model/thinking is a `/herd-new` concern, not a `/herd-push` concern

**Decision:** Model and thinking are picked at `/herd-new` time (from a dropdown,
dynamically fetched from pi's model list, or inherited from the chosen role) and
**persist** for the agent's lifetime. To change a running agent's model, hop
into that pane and use pi's native `/model` (or Ctrl+P) — the widget reflects it
via `state.json`. `/herd-push` carries **no** model/thinking fields. No `--model`,
`--once`, or `--persist` flags. `/tree` covers rerunning flows.

**Options considered:**
- *Persist default + `--once`.* Push override stays switched; `--once` borrows a
  bigger brain for one turn.
- *One-shot default + `--persist`.*
- *Always persist.*

**Rationale (from brainstorm):** The user observed that `--model`/`--once` on
push is superfluous — you can always `/tree` to rerun a flow, and picking the
model at spawn time (persisting it) plus pi's native in-pane `/model` covers
every real need. This is *more* consistent with point #2 ("modify any agent from
within their shell") — the modification literally happens inside that shell via
pi's own command, and the widget reflects it. It also simplifies the push widget
to a single editable field.

---

## D7. Roster badges — name + model + working-tree + elapsed

**Decision:** Each roster row shows: surface glyph (◆/◇), name, model badge,
working-tree state (clean/dirty/branch), and elapsed/last-activity (color-coded
for staleness). Thinking badge is **not** shown in v1.

**Options considered (multi):** name-only; +model; +thinking; +working-tree;
+elapsed.

**Rationale:** Name + model reinforces the "you control the model" pitch and is
glanceable. Working-tree state kills context-bleed and orphaned-worktree pain
by making overlap visible (cheap `git status --short` per pane cwd, written to
`state.json`). Elapsed doubles as the staleness signal (see D8). Thinking is
dropped to avoid crowding; it's recoverable from the model badge's tooltip/detail
in a later phase if needed.

---

## D8. Staleness surfacing — color-coded elapsed + pin current + stale sinks + pulse worst tier

**Decision:**
- Elapsed text colored by threshold: green <2m, amber 2–10m, red >10m,
  **pulse** for the worst tier (>30m). Thresholds configurable in
  `.pi/herd/config.json`.
- Current (focused) agent pinned to top with a `▶` marker.
- Remaining rows sorted by last-activity descending so genuinely stale ones
  sink to the bottom (visible but not distracting).

**Options considered:** color-elapsed + pin + sink; dim stale rows entirely;
separate stale section. Pulse vs dim for worst tier.

**Rationale:** The elapsed badge already carries the staleness signal —
expressing staleness *through* it (color + pulse) adds zero new UI elements,
satisfying "don't crowd the widget." Pulse chosen over dim for the worst tier
because it's more attention-grabbing for genuinely stalled agents; middle tiers
use color only to avoid a perpetually-blinking widget. Pinning current + sinking
stale keeps the working set at the top.

---

## D9. Topology — peer mesh with a ★-marked orchestrator

**Decision:** The herd is a peer mesh of pi instances in one herdr workspace —
no orchestrator *process*. For semantic clarity, the pane where the herd started
is marked `★` (the "orchestrator/main," i.e., "where we started from"),
identified via `HERDR_HERD_MAIN_PANE` env passed to spawned children.

**Options considered:** peer mesh (no main); main + spawned children.

**Rationale:** Philosophically there's no "leader," but for clean user flow and
to always know where the herd started, naming a main (marked `★`) helps.
Mechanically, every peer is identical — each runs the extension, shows the same
roster, can herd any peer. The `★` is a label, not authority.

---

## D10. Surface glyph — ◆/◇ default, configurable, T/P preset

**Decision:** Default glyphs: `◆` (tab) / `◇` (pane). Configurable via
`.pi/herd/config.json`, with a built-in `T`/`P` "bulletproof" preset.

**Options considered:** box-drawing siblings (▤/▥); brackets (⦗/⦘);
plain letters (T/P); filled/hollow diamonds (◆/◇).

**Rationale:** Single-cell unicode only — emoji render double-width and break
TUI row alignment. Diamonds won on aesthetics; the user also liked T/P for
bulletproof legibility, so both ship and are config-switchable. `◆` (filled) for
tab (a whole surface) and `◇` (hollow) for pane (an open split) read as
solid/whole vs open/split.

---

## D11. Workspace scope — orchestrator's workspace only by default

**Decision:** The roster shows only panes/tabs in the orchestrator's workspace
(equivalent to "my own workspace," since children spawn into it). The `★`-main
row is marked via env. `/herd-hide` / `/herd-unhide <name>` (Phase 2) for noise
control; cross-workspace `--all` view (Phase 3) for multi-herd.

**Options considered:** scope to workspace + ★ main; show all workspaces +
per-agent hide.

**Rationale:** herdr's `tab create --workspace <id>` already targets the current
workspace, so `/herd-new` spawns into the orchestrator's workspace by default.
Scoping the roster to that workspace is therefore free (it's just
`herdr pane list --workspace <mine>`) and means a herd = "the agents you spawned
from where you started," with no foreign-workspace clutter. Cross-workspace is a
real need only when running multiple herds — Phase 3.

---

## D12. Config home — `.pi/herd/config.json`, scaffolded by `/herd-init`

**Decision:** Herd-specific config lives in a dedicated `.pi/herd/config.json`,
scaffolded by `/herd-init` (idempotent + merge, `--force` to reset). Defaults
also ship in the package's `config.json` as a fallback layer.

**Options considered:** dedicated `.pi/herd/config.json`; merge into
`.pi/settings.json` under a `herd` key; package `config.json` + project override.

**Rationale:** `.pi/agent/` is a **global** path; the project equivalent is
`.pi/`. A dedicated `.pi/herd/` subdir keeps herd config out of pi's own
settings schema and its merge semantics, while mirroring how the reference
project kept a `config.json` + `config.json.example`. Layered defaults (package
fallback + project override) give sensible out-of-box behavior with per-project
tunability.

---

## D13. Ship role agents — yes, alongside templates

**Decision:** The package ships default "role" agent definitions
(`explorer`/`debugger`/`prototyper`/`reviewer` `.md` files with default
model+thinking frontmatter), materialized into `.pi/agents/` by `/herd-init` so
they're editable and high-priority (pi resolves `.pi/agents/` >
`~/.pi/agent/agents/` > bundled).

**Options considered:** templates only; templates + role agents.

**Rationale:** Roles give `/herd-new` a concrete starting point and demonstrate
the model+thinking frontmatter pattern. Combined with the `compact-for-*`
templates, the package ships a usable herd out of the box and stays fully
user-customizable (everything editable in `.pi/`).

---

## D14. `/herd-new` persona fields — role + goal (two scoped fields)

**Decision:** `/herd-new`'s no-arg widget fields:
- `name` (required)
- `type` (pane | tab, default pane)
- `role` (pick from `.pi/agents/`, or "plain" — optional)
- `model` + `thinking` (optional, defaults inherited from role or pi)
- `goal / extra context` (free text, optional — appended to the role's system
  prompt)

**Options considered:** role + goal (two scoped fields); single autocomplete
input (role name OR free text); free-text "core context" only.

**Rationale:** Role (a full agent definition in `.pi/agents/*.md`) is the right
unit to shape a new agent's *persona*; the `compact-for-*` templates belong to
the *push* flow, not `/herd-new`. Having both role and free-text is only
confusing if mashed into one field; as two scoped fields they compose cleanly
(role = structured persona, goal = unstructured annotation appended to it) with
no "does my free text override the template?" ambiguity.

---

## D15. Architecture — cooperative extension instances + `herdr pane run` + shared `state.json`

**Decision (load-bearing):** The herd is N cooperative extension instances (one
per pi pane; the package is globally installed). They communicate by sending
**base64-encoded extension commands** (`/herd-receive <base64>`) via
`herdr pane run <targetPaneId>`. The display-only widget reads a shared
`.pi/herd/state.json` that each instance writes with its own row
(model/thinking/last-activity/cwd/working-tree/paneId/name/is-main), refreshed
on a timer. The `★`-main is tracked via `HERDR_HERD_MAIN_PANE` env passed to
spawned children.

**Why not RPC:** RPC mode (`pi --mode rpc`) is a headless JSON-over-stdio
protocol that only works when a pane runs pi in *RPC mode* — which means you
**can't interactively hop into that pane and type**. Since the herd pitch is
*interactive panes you co-drive*, target panes run in TUI mode, which exposes
no RPC socket. RPC is a great fit for *headless* orchestration (the sub-agent
pattern being rejected) but structurally can't apply here. For an interactive
pane, the only inbound channel is keystroke injection (`herdr pane run`), and
base64 extension-commands survive that channel intact (no multiline/quote/
backslash fragility).

**Worked push example** (`/herd-push scout`):
1. Orchestrator's extension reads its own last assistant message in-process,
   opens the push widget pre-filled with it (editable).
2. On submit, it base64-encodes `{message, from: <myPaneId>}` and resolves
   "scout" → scout's paneId from the shared roster state.
3. Orchestrator runs `herdr pane run <scoutPaneId> "/herd-receive <base64>"` —
   types the command into scout's pi input and hits Enter.
4. Scout's extension has registered `/herd-receive`; it fires in scout's pi,
   decodes the base64, and injects `message` as scout's next prompt via the
   extension API.
5. Scout processes it like a normal turn. Result is **not** auto-steered — you
   pull it with `/herd-pull scout` (symmetric two-hop round-trip).

**Rationale:** Robust (base64 survives the keystroke channel; no payload
parsing from screen), zero sockets to manage, every pane stays a normal
interactive pi you can drive by hand, and the `★`-main is just a labeled pane.
Cost: a few `pane run` calls per push/pull and a small file write per
heartbeat — trivial.

---

## D16. Busy-target push — queue by default, `--force` interrupts

**Decision:** `/herd-push` into a target that's mid-turn: **queue by default**
(delivered as a steering message after the current turn), or `--force` to
**interrupt (Esc) then push** immediately.

**Options considered:** reject; auto-interrupt then push; queue.

**Rationale:** Queue-by-default respects an in-flight turn (no lost work);
`--force` gives the human the escape hatch to redirect a runaway agent
immediately — which is the whole point of the herd.

---

## D17. Name collisions — default error, configurable auto-suffix

**Decision:** `/herd-new <existing-name>` errors by default; configurable to
auto-suffix (`scout` → `scout-2`) in `.pi/herd/config.json`.

**Rationale:** Error-by-default prevents accidental roster ambiguity (two
"scout" rows); auto-suffix is an opt-in for users who spawn many similar agents.

---

## D18. Closed-pane UX — transient "X exited" then drop

**Decision:** When a pane closes/quits, the roster shows a brief transient
"X exited" line, then drops the row after a few seconds. Duration configurable.

**Rationale:** Silent drops are disorienting ("where did scout go?"); a
permanent tombstone clutters the roster. A short transient gives closure without
baggage.

---

## D19. `/herd-init` safety — idempotent + merge, `--force` to reset

**Decision:** `/herd-init` is idempotent and merge-only — it never overwrites
user edits to `.pi/prompts/`, `.pi/agents/`, or `.pi/herd/config.json`. A
`--force` flag resets them to package defaults.

**Rationale:** Users will customize the scaffolded templates and role agents;
clobbering them on re-init would destroy work. Merge + `--force` gives safe
upgrades and an explicit reset path.

---

## D20. Phase plan — foundation → closed loop → polish/templates → automation

**Decision:** Four phases:
- **Phase 0 — Foundation.** herdr CLI wrapper + pane/agent discovery + state.json
  primitives. No UI, no commands.
- **Phase 1 — Closed herd loop.** `/herd` (toggle display-only widget),
  `/herd-new`, `/herd-push`, `/herd-pull`, `/herd-init`, 5 templates + role
  agents bundled.
- **Phase 2 — Polish & templates.** Interactive selectable widget (focus a pane
  by row), badge polish, `/herd-new --template`, `/herd-save`, `/herd-resume`,
  `/herd-hide`/`/herd-unhide`, `compact-for-*` refinements.
- **Phase 3 — Automation escapes.** Cooperative agent-side pull tool, optional
  lead-agent mode, cross-workspace `--all` view, per-agent worktree isolation
  flags.

**Rationale:** Phase 1 is the smallest set that demonstrates the
differentiation (a human co-driving multiple persistent panes with live,
editable message ferrying) — remove any piece and the loop breaks. Phase 2
makes it pleasant. Phase 3 is where it starts drifting toward the sub-agent
pattern being rejected — only worth building once the manual flow is so smooth
you know exactly which seam to automate.

See [spec/phases/](./spec/phases/) for per-phase specs, todos, and done tracking.
