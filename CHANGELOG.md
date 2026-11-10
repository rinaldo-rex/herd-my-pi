# Changelog

## Unreleased

### Added

- MIT license, installation and quickstart guide, contributor instructions,
  security policy, and issue templates for the public repository.
- Automated release-readiness checks and regression coverage.
- `herd_start` opens the existing `/herd` picker after a team proposal is approved.
  Recommended roles are preselected; the user chooses the final team, models,
  and thinking levels before Start. Cancellation/headless refusal never falls
  back to direct spawning. Both entry points share the picker and launcher.

### Changed

- Route orchestrator and approved sub-agent helper requests through the picker
  instead of model-authored CLI launches. Return actual selections and partial
  launch failures without stale next-turn announcements from tool calls.
- Document the current hc-based architecture, shared-directory safety limits,
  model configuration, lifecycle, and development requirements.
- Let bundled roles inherit the user's default model instead of requiring
  particular provider/model combinations.
- Make `herd_read` distinguish current report readiness from explicit historical
  reads. Expose prompt identities and an optional `after` cursor for reused
  members; pending or failed prompts no longer fall back to old answers.
- Replace premature completion messages with runner-based handoffs. Document
  state cards, file/check ownership, frozen review snapshots, and the strict
  acknowledgement-only blocked-member policy.
- Limit inline `herd_read` output to 50 KiB or 2,000 lines and save full output
  to a private temporary file. Remote session reads are explicitly unsupported.

### Fixed

- Preserve model-picker focus forwarding for text input and IME handling.
- Retain model thinking suffixes, validate thinking levels, and clamp supported
  levels before launch.
- Reject cyclic session history instead of blocking the orchestrator.
- Bound subprocess waits and support cancellation when reading members.
- Keep generated terminal names within hc's limit even after collision suffixes.
- Stop `herd_read` before session-file access when its initial lookup discovers
  that a member is blocked; return only the waiting acknowledgement.

## 0.2.0

- Launch interactive pi members from project or bundled agent templates with
  `/herd`, through herdr-core (`hc`).
- Select each member's model and thinking level in the picker.
- Adopt members into Herdr tabs and optionally let them outlive their parent.
- Publish session labels and read members' full-turn replies with `herd_read`.
- Bundle explorer, implementer, and reviewer roles plus a delegation skill.

The earlier 0.1 design used a different CLI and command set; those commands are
not supported by the 0.2 implementation.
