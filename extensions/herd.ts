// /herd — toggle the display-only roster widget.
// Shows a live roster of all herd agents in the workspace.
// Per-instance visibility, in-memory toggle. Auto-show if HERDR_HERD_WIDGET=1.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getCurrentPaneInfo } from "../src/herdr";
import { loadConfig } from "../src/config";
import { readRoster } from "../src/state";
import { readCurrentPaneId } from "../src/herdr";
import { formatRow, formatClosedRow, sortRows, renderWidgetBox, renderEmptyBox } from "./widget";
import type { Config, RosterRow } from "../src/types";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";

/** State for the widget refresh loop. */
export interface WidgetState {
  visible: boolean;
  interval: ReturnType<typeof setInterval> | null;
  pulsePhase: boolean;
  /** Closed panes with their exit timestamp for transient display. */
  closedPanes: Map<string, { row: RosterRow; exitMs: number }>;
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
  };

  // Register the toggle command
  pi.registerCommand("herd", {
    description: "Toggle the herd roster widget",
    handler: async (_args, ctx) => {
      if (state.visible) {
        stopWidget(ctx, state);
      } else {
        startWidget(pi, ctx, state, projectRoot, configDirName);
      }
    },
  });

  return state;
}

/** Auto-show the widget if HERDR_HERD_WIDGET=1 (passed by /herd-new). */
export function maybeAutoShowWidget(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  state: WidgetState,
  projectRoot: string,
  configDirName: string,
): void {
  if (process.env.HERDR_HERD_WIDGET === "1" && !state.visible) {
    startWidget(pi, ctx, state, projectRoot, configDirName);
  }
}

function startWidget(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  state: WidgetState,
  projectRoot: string,
  configDirName: string,
): void {
  state.visible = true;

  const config = loadConfig(projectRoot, configDirName);
  const id = getCurrentPaneInfo();

  // Render immediately
  renderWidget(pi, ctx, state, config, projectRoot, configDirName, id?.paneId ?? null);

  // Start refresh timer
  state.interval = setInterval(() => {
    // Toggle pulse phase for blink effect
    state.pulsePhase = !state.pulsePhase;
    renderWidget(pi, ctx, state, config, projectRoot, configDirName, id?.paneId ?? null);
  }, config.intervals.widgetRefreshMs);

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
  ctx.ui.setWidget(WIDGET_ID, undefined);
}

function renderWidget(
  _pi: ExtensionAPI,
  ctx: ExtensionContext,
  state: WidgetState,
  config: Config,
  projectRoot: string,
  configDirName: string,
  myPaneId: string | null,
): void {
  if (!state.visible) return;

  const id = getCurrentPaneInfo();
  if (!id) return;

  const currentPaneId = readCurrentPaneId();
  const roster = readRoster(id.workspaceId, projectRoot, configDirName);

  // Track closed panes for transient display
  const now = Date.now();
  const liveIds = new Set(roster.filter((r) => r.live).map((r) => r.paneId));

  // Find newly closed panes
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

  // Build display rows: live rows + transient closed rows
  const liveRows = roster.filter((r) => r.live);
  const closedRows = [...state.closedPanes.values()].map((e) => e.row);

  // Sort live rows: current pinned, then lastActivityMs desc
  const sortedLive = sortRows(liveRows, currentPaneId);

  // Format rows and build the box
  const themeFg = ctx.ui.theme.fg.bind(ctx.ui.theme);
  const rows: Array<{ formatted: string; isClosed: boolean }> = [];

  for (const row of sortedLive) {
    const isCurrent = row.paneId === currentPaneId;
    rows.push({
      formatted: formatRow(row, {
        isCurrent,
        config,
        themeFg,
        now,
        pulsePhase: state.pulsePhase,
      }),
      isClosed: false,
    });
  }

  // Add closed pane transients at the bottom
  for (const row of closedRows) {
    rows.push({
      formatted: formatClosedRow(row, {
        config,
        themeFg,
      }),
      isClosed: true,
    });
  }

  // Render the box
  const lines = rows.length === 0
    ? renderEmptyBox(themeFg)
    : renderWidgetBox(rows, { title: "Herd", themeFg });

  ctx.ui.setWidget(WIDGET_ID, lines);
}

/** Stop the widget on session end. */
export function stopWidgetOnShutdown(state: WidgetState): void {
  if (state.interval) {
    clearInterval(state.interval);
    state.interval = null;
  }
  state.visible = false;
}
