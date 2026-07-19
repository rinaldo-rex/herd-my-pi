// Shared types for herd-my-pi (Phase 0 — foundation).
//
// Naming note: the package is `herd-my-pi`. The `/herd-*` commands and the
// `.pi/herd/` directory use `herd` as a verb for meaningfulness only.

export interface Identity {
  paneId: string;
  tabId: string;
  workspaceId: string;
}

export type AgentStatus = "idle" | "working" | "blocked" | "done" | "unknown";

/**
 * A pane as reported by herdr (`herdr pane get` / `herdr pane list`). This is
 * the LIVE source (D26): presence, agent, agent_status, cwd, session path,
 * focused. herd does not duplicate these into state.json.
 */
export interface HerdrPane {
  pane_id: string;
  tab_id: string;
  workspace_id: string;
  agent?: string;
  agent_status?: AgentStatus;
  cwd?: string;
  focused?: boolean;
  foreground_cwd?: string;
  terminal_title?: string;
  terminal_title_stripped?: string;
  revision?: number;
  agent_session?: {
    agent?: string;
    kind?: string;
    source?: string;
    value?: string; // session .jsonl path
  };
}

/** What `inspectPane` returns. */
export interface PaneInspection {
  kind: "present" | "missing" | "unavailable";
  agent?: string;
  agentStatus?: AgentStatus;
  cwd?: string;
  sessionPath?: string;
}

/**
 * A row in `.pi/herd/state.json` — herd-unique fields ONLY (D26). herdr already
 * tracks presence/agent_status/cwd/session live, so we store just what herdr
 * can't know: name, model, thinking, git working-tree/branch, timing, isMain.
 */
export interface PaneRow {
  paneId: string;
  name: string;
  type: "tab" | "pane";
  workspaceId: string;
  model?: string;
  thinking?: string;
  workingTree?: "clean" | "dirty" | null;
  branch?: string;
  /** Set when spawned with `--isolate` (Phase 1+). */
  worktreePath?: string;
  lastActivityMs: number;
  startedMs: number;
  isMain: boolean;
}

/**
 * A roster row = a live herdr pane JOINed with a herd row (may be partial).
 * `live:false` marks a pane that's in state.json but missing from `herdr pane
 * list` (exited) — the widget decides whether to show-then-drop it.
 */
export interface RosterRow {
  paneId: string;
  name?: string;
  type?: "tab" | "pane";
  workspaceId?: string;
  model?: string;
  thinking?: string;
  agent?: string;
  agentStatus?: AgentStatus;
  cwd?: string;
  workingTree?: "clean" | "dirty" | null;
  branch?: string;
  worktreePath?: string;
  lastActivityMs?: number;
  startedMs?: number;
  isMain?: boolean;
  focused?: boolean;
  live: boolean;
  sessionPath?: string;
}

export interface Config {
  version: number;
  glyphs: {
    agentFilled: string;
    agentOutline: string;
    current: string;
    main: string;
  };
  /** Elapsed-time color thresholds (ms since lastActivityMs). */
  staleness: {
    amberMs: number; // < amberMs => green
    redMs: number; // [amberMs, redMs) => amber
    pulseMs: number; // [redMs, pulseMs) => red; >= pulseMs => pulse
  };
  intervals: {
    heartbeatMs: number;
    widgetRefreshMs: number;
    closedPaneLingerMs: number;
  };
  spawn: {
    defaultDirection: "right" | "down";
    collisionPolicy: "error" | "auto-suffix";
  };
  worktrees: {
    autoDiscardOnClose: boolean;
    branchPrefix: string;
  };
}
