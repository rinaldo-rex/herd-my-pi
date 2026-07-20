// /herd — toggle the display-only roster widget.
// Shows a live roster of all herd agents in the workspace.
// Per-instance visibility, in-memory toggle. Auto-show if HERDR_HERD_WIDGET=1.
//
// Phase 2: /herd cycles: off → compact → detail(depth 1) → detail(all) → off.
// Compact mode = Phase 1 rows + thinking badge. Detail adds sub-lines.
// Exited-pane transients show countdown seconds and auto-delete from state.json
// after the configured linger period.
//
// Uses the component-factory form of setWidget so render(width) receives the
// actual viewport width from the TUI (process.stdout.columns can be wider
// than the widget area and causes wrapping).

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getCurrentPaneInfo, readCurrentPaneId, getWorkspaceLabel, countUnmergedHerdWorktrees } from "../src/herdr";
import { loadConfig } from "../src/config";
import { readRoster, removeSelfRow } from "../src/state";
import { formatRow, formatClosedRow, formatDetailLines, sortRows, renderWidgetBox, renderEmptyBox } from "./widget";
import type { Config, RosterRow } from "../src/types";

/** Widget visibility / detail mode. */
export type WidgetMode = "off" | "compact" | "detail" | "detailAll";

export interface WidgetState {
  mode: WidgetMode;
  interval: ReturnType<typeof setInterval> | null;
  pulsePhase: boolean;
  /** Closed panes with their exit timestamp for transient display. */
  closedPanes: Map<string, { row: RosterRow; exitMs: number }>;
  /** Set of closed panes already cleaned from state.json (don't re-delete). */
  cleanedPanes: Set<string>;
  /** Latest computed rows — read by render(width) on each TUI paint. */
  lastRows: Array<{ formatted: string; detail: string[]; isClosed: boolean }>;
  /** True when there are no live/closed rows at all (empty placeholder). */
  lastEmpty: boolean;
  /** TUI instance captured from the widget factory, for requestRender(). */
  tui: { requestRender(force?: boolean): void } | null;
  /** Theme instance captured from the widget factory. */
  theme: { fg(color: any, text: string): string } | null;
  /** Inputs needed to rebuild rows each tick. */
  config: Config | null;
  projectRoot: string;
  configDirName: string;
  /** Cached workspace label for the title bar (resolved once, refreshable). */
  workspaceLabel: string;
  /** Cached unmerged worktree count (updated each refresh). */
  unmergedWt: number;
}

const WIDGET_ID = "herd";

export function registerHerd(
  pi: ExtensionAPI,
  projectRoot: string,
  configDirName: string,
): WidgetState {
  const state: WidgetState = {
    mode: "off",
    interval: null,
    pulsePhase: false,
    closedPanes: new Map(),
    cleanedPanes: new Set(),
    lastRows: [],
    lastEmpty: true,
    tui: null,
    theme: null,
    config: null,
    projectRoot,
    configDirName,
    workspaceLabel: "Herd",
    unmergedWt: 0,
  };

  // Register the toggle command — cycles: off → compact → detail → detailAll → off
  pi.registerCommand("herd", {
    description: "Toggle the herd roster widget (off → compact → detail → full-detail → off)",
    handler: async (_args, ctx) => {
      cycleWidget(ctx, state);
    },
  });

  return state;
}

/** Auto-show the widget if HERDR_HERD_WIDGET=1 (passed by /herd-new). Shows compact mode. */
export function maybeAutoShowWidget(
  _pi: ExtensionAPI,
  ctx: ExtensionContext,
  state: WidgetState,
  _projectRoot: string,
  _configDirName: string,
): void {
  if (process.env.HERDR_HERD_WIDGET === "1" && state.mode === "off") {
    startWidget(ctx, state, "compact");
  }
}

/** Cycle the widget: off → compact → detail(depth 1) → detailAll → off. */
function cycleWidget(ctx: ExtensionContext, state: WidgetState): void {
  switch (state.mode) {
    case "off":
      startWidget(ctx, state, "compact");
      break;
    case "compact":
      restartWidget(ctx, state, "detail");
      break;
    case "detail":
      restartWidget(ctx, state, "detailAll");
      break;
    case "detailAll":
      stopWidget(ctx, state);
      break;
  }
}

function startWidget(ctx: ExtensionContext, state: WidgetState, initialMode: WidgetMode): void {
  state.mode = initialMode;
  state.config = loadConfig(state.projectRoot, state.configDirName);

  // Register the widget as a component so render(width) gets the real width.
  ctx.ui.setWidget(WIDGET_ID, (tui: any, theme: any) => {
    state.tui = tui;
    state.theme = theme;
    return {
      render: (width: number): string[] => {
        if (state.mode === "off" || !state.theme) return [];
        const themeFg = state.theme.fg.bind(state.theme);
        if (state.lastEmpty) {
          return renderEmptyBox(themeFg, width, state.workspaceLabel);
        }
        const detailDepth = state.mode === "detailAll" ? -1 : state.mode === "detail" ? 1 : 0;
        const badge = state.unmergedWt > 0 ? `⊕ ${state.unmergedWt} unmerged` : undefined;
        return renderWidgetBox(state.lastRows, {
          title: state.workspaceLabel,
          themeFg,
          width,
          detailDepth,
          badge,
        });
      },
      invalidate: () => {},
    };
  });

  refreshData(ctx, state);
  state.tui?.requestRender();

  state.interval = setInterval(() => {
    state.pulsePhase = !state.pulsePhase;
    refreshData(ctx, state);
    state.tui?.requestRender();
  }, state.config!.intervals.widgetRefreshMs);

  if (state.interval && typeof state.interval.unref === "function") {
    state.interval.unref();
  }
}

function restartWidget(ctx: ExtensionContext, state: WidgetState, newMode: WidgetMode): void {
  state.mode = newMode;
  if (!state.tui) {
    startWidget(ctx, state, newMode);
    return;
  }
  refreshData(ctx, state);
  state.tui.requestRender();
}

function stopWidget(ctx: ExtensionContext, state: WidgetState): void {
  state.mode = "off";
  if (state.interval) {
    clearInterval(state.interval);
    state.interval = null;
  }
  state.closedPanes.clear();
  state.cleanedPanes.clear();
  state.lastRows = [];
  state.lastEmpty = true;
  ctx.ui.setWidget(WIDGET_ID, undefined);
}

/** Recompute the rows from the current roster and stash them in state. */
function refreshData(ctx: ExtensionContext, state: WidgetState): void {
  if (state.mode === "off" || !state.config) return;

  const id = getCurrentPaneInfo();
  if (!id) {
    state.lastRows = [];
    state.lastEmpty = true;
    return;
  }

  const config = state.config;
  const currentPaneId = readCurrentPaneId();
  const roster = readRoster(id.workspaceId, state.projectRoot, state.configDirName);
  const themeFg = ctx.ui.theme.fg.bind(ctx.ui.theme);
  const now = Date.now();

  state.workspaceLabel = getWorkspaceLabel(id.workspaceId) ?? "Herd";
  // Count unmerged herd worktrees (best-effort; swallow errors if wt not installed)
  try {
    state.unmergedWt = countUnmergedHerdWorktrees(config.worktrees.branchPrefix);
  } catch {
    state.unmergedWt = 0;
  }

  // Track newly dead panes (first time seen as dead — not already in closedPanes)
  for (const row of roster) {
    if (!row.live && !state.closedPanes.has(row.paneId)) {
      state.closedPanes.set(row.paneId, { row, exitMs: now });
    }
  }

  // Remove expired closed panes from display AND from state.json (Phase 2)
  for (const [paneId, entry] of state.closedPanes) {
    if (now - entry.exitMs > config.intervals.closedPaneLingerMs) {
      state.closedPanes.delete(paneId);
      // Clean from state.json once per pane, so they don't reappear on next widget start
      if (!state.cleanedPanes.has(paneId)) {
        state.cleanedPanes.add(paneId);
        removeSelfRow(state.projectRoot, paneId, state.configDirName);
      }
    }
  }

  const liveRows = roster.filter((r) => r.live);
  const sortedLive = sortRows(liveRows, currentPaneId, config.widget.staleFirst);

  const rows: Array<{ formatted: string; detail: string[]; isClosed: boolean }> = [];
  for (const row of sortedLive) {
    rows.push({
      formatted: formatRow(row, {
        isCurrent: row.paneId === currentPaneId,
        config,
        themeFg,
        now,
        pulsePhase: state.pulsePhase,
      }),
      detail: formatDetailLines(row, { themeFg }),
      isClosed: false,
    });
  }
  // Closed-pane transients with countdown
  for (const [paneId, entry] of state.closedPanes) {
    const remainingMs = config.intervals.closedPaneLingerMs - (now - entry.exitMs);
    rows.push({
      formatted: formatClosedRow(entry.row, { themeFg, remainingMs }),
      detail: [],
      isClosed: true,
    });
  }

  state.lastRows = rows;
  state.lastEmpty = rows.length === 0;
}

/** Stop the widget on session end. */
export function stopWidgetOnShutdown(state: WidgetState): void {
  if (state.interval) {
    clearInterval(state.interval);
    state.interval = null;
  }
  state.mode = "off";
}
