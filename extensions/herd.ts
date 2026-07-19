// /herd — toggle the display-only roster widget.
// Shows a live roster of all herd agents in the workspace.
// Per-instance visibility, in-memory toggle. Auto-show if HERDR_HERD_WIDGET=1.
//
// Uses the component-factory form of setWidget so render(width) receives the
// actual viewport width from the TUI (process.stdout.columns can be wider
// than the widget area and causes wrapping).

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getCurrentPaneInfo, readCurrentPaneId, getWorkspaceLabel } from "../src/herdr";
import { loadConfig } from "../src/config";
import { readRoster } from "../src/state";
import { formatRow, formatClosedRow, sortRows, renderWidgetBox, renderEmptyBox } from "./widget";
import type { Config, RosterRow } from "../src/types";

/** State for the widget refresh loop. */
export interface WidgetState {
  visible: boolean;
  interval: ReturnType<typeof setInterval> | null;
  pulsePhase: boolean;
  /** Closed panes with their exit timestamp for transient display. */
  closedPanes: Map<string, { row: RosterRow; exitMs: number }>;
  /** Latest computed rows — read by render(width) on each TUI paint. */
  lastRows: Array<{ formatted: string; isClosed: boolean }>;
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
}

const WIDGET_ID = "herd";

export function registerHerd(
  pi: ExtensionAPI,
  projectRoot: string,
  configDirName: string,
): WidgetState {
  const state: WidgetState = {
    visible: false,
    interval: null,
    pulsePhase: false,
    closedPanes: new Map(),
    lastRows: [],
    lastEmpty: true,
    tui: null,
    theme: null,
    config: null,
    projectRoot,
    configDirName,
    workspaceLabel: "Herd",
  };

  // Register the toggle command
  pi.registerCommand("herd", {
    description: "Toggle the herd roster widget",
    handler: async (_args, ctx) => {
      if (state.visible) {
        stopWidget(ctx, state);
      } else {
        startWidget(ctx, state);
      }
    },
  });

  return state;
}

/** Auto-show the widget if HERDR_HERD_WIDGET=1 (passed by /herd-new). */
export function maybeAutoShowWidget(
  _pi: ExtensionAPI,
  ctx: ExtensionContext,
  state: WidgetState,
  _projectRoot: string,
  _configDirName: string,
): void {
  if (process.env.HERDR_HERD_WIDGET === "1" && !state.visible) {
    startWidget(ctx, state);
  }
}

function startWidget(ctx: ExtensionContext, state: WidgetState): void {
  state.visible = true;
  state.config = loadConfig(state.projectRoot, state.configDirName);

  // Register the widget as a component so render(width) gets the real width.
  ctx.ui.setWidget(WIDGET_ID, (tui: any, theme: any) => {
    // Capture tui + theme for the refresh timer.
    state.tui = tui;
    state.theme = theme;
    return {
      render: (width: number): string[] => {
        if (!state.visible || !state.theme) return [];
        const themeFg = state.theme.fg.bind(state.theme);
        return state.lastEmpty
          ? renderEmptyBox(themeFg, width, state.workspaceLabel)
          : renderWidgetBox(state.lastRows, { title: state.workspaceLabel, themeFg, width });
      },
      invalidate: () => {
        // Nothing cached inside the component; data lives in state.
      },
    };
  });

  // Render once immediately, then start the refresh timer.
  refreshData(ctx, state);
  state.tui?.requestRender();

  state.interval = setInterval(() => {
    state.pulsePhase = !state.pulsePhase;
    refreshData(ctx, state);
    state.tui?.requestRender();
  }, state.config.intervals.widgetRefreshMs);

  // Don't keep the event loop alive solely for the widget
  if (state.interval && typeof state.interval.unref === "function") {
    state.interval.unref();
  }
}

function stopWidget(ctx: ExtensionContext, state: WidgetState): void {
  state.visible = false;
  if (state.interval) {
    clearInterval(state.interval);
    state.interval = null;
  }
  state.closedPanes.clear();
  state.lastRows = [];
  state.lastEmpty = true;
  ctx.ui.setWidget(WIDGET_ID, undefined);
}

/** Recompute the rows from the current roster and stash them in state. */
function refreshData(ctx: ExtensionContext, state: WidgetState): void {
  if (!state.visible || !state.config) return;

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

  // Resolve workspace label for the title bar
  state.workspaceLabel = getWorkspaceLabel(id.workspaceId) ?? "Herd";

  // Track newly closed panes for transient display
  for (const row of roster) {
    if (!row.live && !state.closedPanes.has(row.paneId)) {
      state.closedPanes.set(row.paneId, { row, exitMs: now });
    }
  }
  // Remove expired closed panes
  for (const [paneId, entry] of state.closedPanes) {
    if (now - entry.exitMs > config.intervals.closedPaneLingerMs) {
      state.closedPanes.delete(paneId);
    }
  }

  const liveRows = roster.filter((r) => r.live);
  const closedRows = [...state.closedPanes.values()].map((e) => e.row);
  const sortedLive = sortRows(liveRows, currentPaneId);

  const rows: Array<{ formatted: string; isClosed: boolean }> = [];
  for (const row of sortedLive) {
    rows.push({
      formatted: formatRow(row, {
        isCurrent: row.paneId === currentPaneId,
        config,
        themeFg,
        now,
        pulsePhase: state.pulsePhase,
      }),
      isClosed: false,
    });
  }
  for (const row of closedRows) {
    rows.push({
      formatted: formatClosedRow(row, { themeFg }),
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
  state.visible = false;
}
