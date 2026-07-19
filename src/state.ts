// Shared roster state IO (`.pi/herd-my-pi/state.json`).
//
// Per D26, state.json stores herd-unique fields only. The roster is a JOIN of
// `herdr pane list` (live presence/agent_status/cwd/session) with state.json
// (herd-unique supplements) on `paneId`. readRoster performs that join.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type HerdrPane, type PaneRow, type RosterRow, HERD_DIR_NAME } from "./types";
import { listPanes } from "./herdr";

export function stateFilePath(projectRoot: string, configDirName = ".pi"): string {
  return join(projectRoot, configDirName, HERD_DIR_NAME, "state.json");
}

interface StateFile {
  version: number;
  rows: PaneRow[];
}

export function loadState(projectRoot: string, configDirName = ".pi"): PaneRow[] {
  const path = stateFilePath(projectRoot, configDirName);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return []; // absent: empty
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return []; // malformed: recover to empty
  }
  if (Array.isArray((data as StateFile)?.rows)) return (data as StateFile).rows;
  if (Array.isArray(data)) return data as PaneRow[]; // tolerant legacy shape
  return [];
}

// Merge a new row into an existing one: defined values in `row` win;
// undefined preserves the existing value (so a caller that omits an optional
// field doesn't clobber what's already stored). null is a real value, kept.
function mergeRow(existing: PaneRow, row: PaneRow): PaneRow {
  const out: Record<string, unknown> = { ...existing };
  for (const [k, v] of Object.entries(row)) {
    if (v !== undefined) out[k] = v;
  }
  return out as unknown as PaneRow;
}

function persist(projectRoot: string, rows: PaneRow[], configDirName: string): void {
  const path = stateFilePath(projectRoot, configDirName);
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmp, JSON.stringify({ version: 1, rows }, null, 2), "utf8");
  renameSync(tmp, path); // atomic on the same filesystem
}

export function saveState(projectRoot: string, rows: PaneRow[], configDirName = ".pi"): void {
  persist(projectRoot, rows, configDirName);
}

/** Merge/replace this instance's own row (keyed by paneId). Returns the new full row set. */
export function writeSelfRow(projectRoot: string, row: PaneRow, configDirName = ".pi"): PaneRow[] {
  const rows = loadState(projectRoot, configDirName);
  const idx = rows.findIndex((r) => r.paneId === row.paneId);
  if (idx >= 0) {
    rows[idx] = mergeRow(rows[idx], row); // new defined values win; undefined preserves existing
  } else {
    rows.push(row);
  }
  persist(projectRoot, rows, configDirName);
  return rows;
}

export function removeSelfRow(projectRoot: string, paneId: string, configDirName = ".pi"): void {
  const rows = loadState(projectRoot, configDirName).filter((r) => r.paneId !== paneId);
  persist(projectRoot, rows, configDirName);
}

/**
 * JOIN `herdr pane list --workspace <id>` (live) with state.json (herd-unique)
 * ON `paneId`. `panesProvider` is injectable for testing (default: real herdr).
 * Panes in state.json but missing from `pane list` are returned with
 * `live:false` (exited) — the widget decides whether to show-then-drop.
 */
export function readRoster(
  workspaceId: string,
  projectRoot: string,
  configDirName = ".pi",
  panesProvider: (wsId: string) => HerdrPane[] = (wsId) => listPanes(wsId),
): RosterRow[] {
  const live = panesProvider(workspaceId);
  const rows = loadState(projectRoot, configDirName);
  const byPane = new Map<string, PaneRow>(rows.map((r) => [r.paneId, r] as const));
  const out: RosterRow[] = [];

  for (const p of live) {
    out.push(joinPane(p, byPane.get(p.pane_id)));
  }
  for (const h of rows) {
    if (!live.some((p) => p.pane_id === h.paneId)) {
      out.push({
        paneId: h.paneId,
        name: h.name,
        type: h.type,
        workspaceId: h.workspaceId,
        model: h.model,
        thinking: h.thinking,
        workingTree: h.workingTree,
        branch: h.branch,
        worktreePath: h.worktreePath,
        lastActivityMs: h.lastActivityMs,
        startedMs: h.startedMs,
        isMain: h.isMain,
        live: false,
      });
    }
  }
  return out;
}

function joinPane(p: HerdrPane, h?: PaneRow): RosterRow {
  return {
    paneId: p.pane_id,
    name: h?.name,
    type: h?.type,
    workspaceId: p.workspace_id ?? h?.workspaceId,
    model: h?.model,
    thinking: h?.thinking,
    agent: p.agent,
    agentStatus: p.agent_status,
    cwd: p.cwd,
    workingTree: h?.workingTree,
    branch: h?.branch,
    worktreePath: h?.worktreePath,
    lastActivityMs: h?.lastActivityMs,
    startedMs: h?.startedMs,
    isMain: h?.isMain ?? false,
    focused: p.focused,
    live: true,
    sessionPath: p.agent_session?.value,
  };
}
