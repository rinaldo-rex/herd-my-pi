// Shared roster state IO (`.pi/herd-my-pi/state.json`).
//
// Per D26, state.json stores herd-unique fields only. The roster is a JOIN of
// `herdr pane list` (live presence/agent_status/cwd/session) with state.json
// (herd-unique supplements) on `paneId`. readRoster performs that join.

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type HerdrPane, type PaneRow, type RosterRow, type HerdTemplate, HERD_DIR_NAME } from "./types";
import { listPanes, listTabs } from "./herdr";

export function stateFilePath(projectRoot: string, configDirName = ".pi"): string {
  return join(projectRoot, configDirName, HERD_DIR_NAME, "state.json");
}

interface StateFile {
  version: number;
  rows: PaneRow[];
  /** Phase 2: hidden pane ids (per-workspace; we store globally for simplicity). */
  hiddenPaneIds?: string[];
}

export function loadState(projectRoot: string, configDirName = ".pi"): PaneRow[] {
  const file = loadStateFile(projectRoot, configDirName);
  return file.rows;
}

/** Load the full state file, including hidden pane ids. */
export function loadStateFile(projectRoot: string, configDirName = ".pi"): StateFile {
  const path = stateFilePath(projectRoot, configDirName);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return { version: 1, rows: [] }; // absent: empty
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { version: 1, rows: [] }; // malformed: recover to empty
  }
  const sf = data as StateFile;
  if (Array.isArray(sf.rows)) {
    return { version: sf.version ?? 1, rows: sf.rows, hiddenPaneIds: sf.hiddenPaneIds };
  }
  if (Array.isArray(data)) return { version: 1, rows: data as PaneRow[] }; // tolerant legacy shape
  return { version: 1, rows: [] };
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

function persist(projectRoot: string, rows: PaneRow[], configDirName: string, hiddenPaneIds?: string[]): void {
  const path = stateFilePath(projectRoot, configDirName);
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
  const file: StateFile = { version: 1, rows };
  if (hiddenPaneIds && hiddenPaneIds.length > 0) file.hiddenPaneIds = hiddenPaneIds;
  writeFileSync(tmp, JSON.stringify(file, null, 2), "utf8");
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
  const file = loadStateFile(projectRoot, configDirName);
  const rows = file.rows.filter((r) => r.paneId !== paneId);
  persist(projectRoot, rows, configDirName, file.hiddenPaneIds);
}

// --- Phase 2: hidden panes ---

/** Get the set of hidden pane ids. */
export function getHiddenPaneIds(projectRoot: string, configDirName = ".pi"): Set<string> {
  const file = loadStateFile(projectRoot, configDirName);
  return new Set(file.hiddenPaneIds ?? []);
}

/** Hide a pane by name — resolves name→paneId first. Returns the resolved paneId or null. */
export function hidePane(projectRoot: string, name: string, configDirName = ".pi"): string | null {
  const file = loadStateFile(projectRoot, configDirName);
  const row = file.rows.find((r) => r.name === name);
  if (!row) return null;
  const hidden = new Set(file.hiddenPaneIds ?? []);
  hidden.add(row.paneId);
  persist(projectRoot, file.rows, configDirName, [...hidden]);
  return row.paneId;
}

/** Unhide a pane by name — resolves name→paneId first. Returns the resolved paneId or null. */
export function unhidePane(projectRoot: string, name: string, configDirName = ".pi"): string | null {
  const file = loadStateFile(projectRoot, configDirName);
  const row = file.rows.find((r) => r.name === name);
  if (!row) return null;
  const hidden = new Set(file.hiddenPaneIds ?? []);
  hidden.delete(row.paneId);
  persist(projectRoot, file.rows, configDirName, [...hidden]);
  return row.paneId;
}

// --- Phase 2: templates ---

/** Path to the templates directory. */
export function templatesDir(projectRoot: string, configDirName = ".pi"): string {
  return join(projectRoot, configDirName, HERD_DIR_NAME, "templates");
}

/** List saved template names (without .json extension). */
export function listTemplates(projectRoot: string, configDirName = ".pi"): string[] {
  const dir = templatesDir(projectRoot, configDirName);
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f: string) => f.endsWith(".json"))
      .map((f: string) => f.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}

/** Load a template by name. */
export function loadTemplate(name: string, projectRoot: string, configDirName = ".pi"): HerdTemplate | null {
  const path = join(templatesDir(projectRoot, configDirName), `${name}.json`);
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw) as HerdTemplate;
  } catch {
    return null;
  }
}

/** Save a template. */
export function saveTemplate(tmpl: HerdTemplate, projectRoot: string, configDirName = ".pi"): void {
  const dir = templatesDir(projectRoot, configDirName);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${tmpl.name}.json`);
  writeFileSync(path, JSON.stringify(tmpl, null, 2), "utf8");
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
  tabsProvider: (wsId: string) => Array<{ tab_id: string; label: string }> = (wsId) => listTabs(wsId),
): RosterRow[] {
  const file = loadStateFile(projectRoot, configDirName);
  const rows = file.rows;
  const hiddenIds = new Set(file.hiddenPaneIds ?? []);

  const live = panesProvider(workspaceId);
  const byPane = new Map<string, PaneRow>(rows.map((r) => [r.paneId, r] as const));
  // Build tab_id → label map
  const tabLabels = new Map<string, string>();
  for (const t of tabsProvider(workspaceId)) {
    tabLabels.set(t.tab_id, t.label);
  }
  const out: RosterRow[] = [];

  for (const p of live) {
    // Skip hidden panes (unless user explicitly unhides)
    if (hiddenIds.has(p.pane_id)) continue;
    out.push(joinPane(p, byPane.get(p.pane_id), tabLabels));
  }
  for (const h of rows) {
    // Skip hidden panes
    if (hiddenIds.has(h.paneId)) continue;
    if (!live.some((p) => p.pane_id === h.paneId)) {
      out.push({
        paneId: h.paneId,
        name: h.name,
        type: h.type,
        workspaceId: h.workspaceId,
        model: h.model,
        thinking: h.thinking,
        role: h.role,
        goal: h.goal,
        workingTree: h.workingTree,
        branch: h.branch,
        worktreePath: h.worktreePath,
        lastActivityMs: h.lastActivityMs,
        startedMs: h.startedMs,
        isMain: h.isMain,
        warnings: h.warnings,
        live: false,
      });
    }
  }
  return out;
}

function joinPane(p: HerdrPane, h?: PaneRow, tabLabels?: Map<string, string>): RosterRow {
  return {
    paneId: p.pane_id,
    tabId: p.tab_id,
    name: h?.name,
    type: h?.type,
    workspaceId: p.workspace_id ?? h?.workspaceId,
    model: h?.model,
    thinking: h?.thinking,
    role: h?.role,
    goal: h?.goal,
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
    terminalTitle: p.terminal_title_stripped,
    tabLabel: tabLabels?.get(p.tab_id),
    warnings: h?.warnings,
  };
}
