# Contributing

Bug reports, focused fixes, and documentation improvements are welcome. Check
existing [issues](https://github.com/rinaldo-rex/herd-my-pi/issues) before starting
large changes. Keep unrelated refactors out of a fix.

## Development setup

Use Node.js **24.x** and **pnpm 12.18.0**, as recorded in `package.json`.
Development dependencies pin the pi APIs used by this package. The pi host
supplies runtime peers; do not move those packages into `dependencies` or bundle
duplicate copies. See pi's [package documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md).

```sh
git clone https://github.com/rinaldo-rex/herd-my-pi.git
cd herd-my-pi
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` runs tests, typechecking, and tarball validation. To run just one
part, use `pnpm test`, `pnpm typecheck`, or `pnpm pack:check`. Automated CI checks
the minimum Node 24.0.0 and the latest Node 24.x on Linux.

There is no compilation step for installation: pi loads the TypeScript entry
point. Dependency lifecycle scripts are restricted in `pnpm-workspace.yaml`;
do not approve additional scripts without reviewing why they are needed.

## Layout

| Path | Responsibility |
| --- | --- |
| `extensions/herd.ts` | Extension registration, `/herd`, lifecycle, and `herd_read`. |
| `src/agents.ts` | Project/bundled template discovery and copying. |
| `src/hc.ts` | Argument-array subprocess wrappers for `hc` and `herdr-app`. |
| `src/models.ts`, `src/picker.ts` | Model resolution, thinking levels, and interactive selection. |
| `src/session.ts` | Read-only extraction of replies from pi sessions. |
| `agents/` | Bundled role templates. |
| `skills/herd-my-pi/` | Instructions for agent-to-agent coordination. |
| `tests/` | Automated tests; external services and live agents must not be required. |

## Before submitting

- Run `pnpm check` with a frozen-lockfile installation.
- Add a regression test for behavior changes, including failure cases.
- Use synthetic fixtures: no real home directories, session transcripts,
  credentials, or private project content.
- Keep subprocess calls as explicit argument arrays; never interpolate template
  content into shell commands.
- Read the documentation for the pinned pi API before changing integration code.
- Update the README/changelog when behavior or requirements change.
- Use conventional commit subjects, for example `fix(session): handle empty replies`.

Do not add tests that operate on a person's actual hc terminals, kill running
agents, restart herdr-core, or require provider credentials. Mock external CLI
responses and use temporary directories for fixtures.

## Manual integration smoke test

Run this separately from automated tests, in a disposable working directory.
It starts real agents and can consume provider quota. Record the Node, pi,
`hc`, and `herdr-app` versions with the result.

1. Install this checkout globally with `pi install /absolute/path/to/herd-my-pi`.
   Start a new pi inside Herdr.
2. Run `/herd`, decline template copying, and cancel the picker. No member
   should start. Repeat, accept copying, and inspect the copied templates.
3. Select one member. Use Tab to choose an authenticated model; cycle thinking
   with Shift+Tab. Start it and verify its tab, name, and cwd.
4. Give that member a short read-only task. Wait for the runner's completed
   turn and collect with default `herd_read`. Check `readiness: ready`, preserve
   `latestPromptId`, and verify multi-message text is intact without modifying
   the session file. Assign a second task and use `after` with the prior prompt
   ID: a pending task must not return the first report. Explicit `last` reads
   should instead be labeled historical. A ready report is not proof its claims
   or tests are correct.
5. Confirm the member can message the orchestrator with `hc send`. Open its tab
   and give it a new instruction yourself; verify you can steer it normally.
6. In disposable sessions, check default parent-lifetime behavior and
   `/herd --outlive`. Save any work, then explicitly stop only the test members
   you started. Never use a core-wide stop/restart for cleanup.
7. If relevant, repeat without the desktop app in an isolated test environment;
   members should remain inspectable through hc even without tabs.

Passing unit tests is not a substitute for these checks. Do not describe a
manual test as passed unless you actually performed it.

## Inspect the package

Create the tarball outside the repository:

```sh
pack_dir=$(mktemp -d)
pnpm pack --pack-destination "$pack_dir"
tar -tzf "$pack_dir"/*.tgz
```

The archive should include the extension, `src/`, bundled agents, skill, license,
and public documentation. It must not contain `.pi/`, `node_modules/`, tests,
credentials, or local session files. Test installation from a git checkout as
well as the archive before making a release.

## Release checklist

- [ ] Checks pass on a fresh frozen-lockfile installation.
- [ ] Relevant manual smoke tests are performed and recorded.
- [ ] Package contents are inspected; version and changelog agree.
- [ ] Security scans cover tracked files and Git history.
- [ ] GitHub private vulnerability reporting is enabled, if available.
- [ ] CI passes on the branch; protect the default branch as appropriate.
- [ ] Tagging, publishing, and pushes are explicitly authorized by the maintainer.

CI, tags, releases, and registry publication are separate steps. Changing files
locally does not publish a release.
