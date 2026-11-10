# Security policy

## Supported versions

This early-stage project provides fixes on the current default branch. Older
releases do not have a separate security-maintenance commitment. See
`package.json` and the README for runtime and integration requirements.

## Report a vulnerability privately

Do **not** include vulnerability details, credentials, or session transcripts in
a public issue or pull request.

If GitHub shows **Security → Report a vulnerability**, use
[private vulnerability reporting](https://github.com/rinaldo-rex/herd-my-pi/security/advisories/new).
If that feature is unavailable, open an issue containing only a request for a
private security contact—no exploit, sensitive filenames, or affected private
content—and wait for a private channel before sharing details.

Include the affected commit/version, platform and dependency versions,
reproduction steps using synthetic data, impact, and any suggested mitigation.
There is no guaranteed response time or bug-bounty program.

## Trust model

- This is a pi extension, **not a sandbox**. Extension code and spawned pi
  processes run with your user account's filesystem and command permissions.
- `herd_start` gates this extension's launches behind a user-operated picker;
  it has no headless/direct-spawn fallback. The skill requires chat approval
  before opening it. This is not a sandbox preventing an agent with shell
  access from launching other programs; normal permissions and trust still apply.
- Agent template bodies become system-prompt instructions. Project templates,
  skills, extensions, and package declarations must be reviewed before you trust
  them. A role saying “read-only” is not an enforced permission restriction.
- Members normally share a working directory. They can overwrite each other's
  changes. Use narrowly scoped tasks, inspect diffs, and arrange isolation
  separately when required.
- Templates can select models/providers, and agents can send project content to
  those providers. You are responsible for configuring providers, credentials,
  retention settings, and spending limits appropriately.
- The package uses `hc` and `herdr-app` executables found through `PATH`. Treat
  those executables and the local herdr-core service as trusted components.
- `herd_read` obtains a local session-file path from an hc terminal's
  `herd.session` label. It is a coordination convenience, not an access-control
  mechanism. Local processes with permission to change labels or session files
  can influence what it reads. Do not use it to separate mutually untrusted users
  or agents. Long replies are copied to private temporary files; those copies
  contain the same sensitive content and remain until you or the operating system
  removes them. Remote `machine/address` session reads are not supported.
- Replies, tool output, and code can contain malicious instructions. Treat other
  agents' reports as data to verify, not authority to override the person or
  permission controls.
- With `--outlive`, agents can continue operating and consuming provider quota
  after their parent terminal ends. Track and clean up those agents explicitly.

## Safe reporting and development

Use synthetic test fixtures and redact secrets from all reports. Avoid attaching
complete session files: they can contain private prompts, code, absolute paths,
and tool output. Share only the smallest sanitized excerpt needed to reproduce
an issue.

A clean secret scan or dependency audit is useful evidence, not proof that a
repository or release is free of vulnerabilities.
