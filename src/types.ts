// Shared types for herd-my-pi (Phase 0 — foundation).
//
// Naming convention: the package is `herd-my-pi`. The bare word `herd` is
// reserved for commands (`/herd-*`, a verb). All other identifiers use the
// full package name — e.g. the install/state directory is `.pi/herd-my-pi/`.
// HERD_DIR_NAME below is the single source of truth for that subdirectory.

/** Subdirectory under `<project>/.pi/` (CONFIG_DIR_NAME) for herd-my-pi files. */
export const HERD_DIR_NAME = "herd-my-pi";

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
 * A row in `.pi/herd-my-pi/state.json` — herd-unique fields ONLY (D26). herdr already
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
  tabId?: string;
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
  /** Fallback label from herdr's live terminal_title (when state.json has no name). */
  terminalTitle?: string;
  /** Tab label as set by the user in herdr (e.g. renamed tab). */
  tabLabel?: string;
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
