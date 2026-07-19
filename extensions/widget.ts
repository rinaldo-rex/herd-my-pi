// Roster widget utilities — row formatting, color thresholds, sorting, pulse.
// Uses A5 (rounded corners) + A9 (accent dots) design.

import type { Config, RosterRow } from "../src/types";

/** Box-drawing characters for rounded corners. */
const BOX = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
} as const;

/** Status dot characters by state. */
const STATUS_DOT = {
  live: "●",    // green
  idle: "◐",    // amber
  dead: "○",    // dim
} as const;

/** Format elapsed ms as a human-readable string. */
export function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainMins = minutes % 60;
  if (hours < 24) return remainMins > 0 ? `${hours}h${remainMins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/** Determine elapsed color tier based on staleness thresholds. */
export function elapsedTier(
  elapsedMs: number,
  config: Config,
): "green" | "amber" | "red" | "pulse" {
  if (elapsedMs < config.staleness.amberMs) return "green";
  if (elapsedMs < config.staleness.redMs) return "amber";
  if (elapsedMs < config.staleness.pulseMs) return "red";
  return "pulse";
}

/** Apply color to elapsed text based on tier. Uses theme.fg(). */
export function colorElapsed(
  text: string,
  tier: "green" | "amber" | "red" | "pulse",
  themeFg: (color: any, text: string) => string,
  pulsePhase: boolean,
): string {
  switch (tier) {
    case "green":
      return themeFg("success", text);
    case "amber":
      return themeFg("warning", text);
    case "red":
      return themeFg("error", text);
    case "pulse":
      // Pulse: alternate between red and dim for attention
      return pulsePhase ? themeFg("error", text) : themeFg("dim", text);
  }
}

/** Get the status dot for a row based on its elapsed tier. */
function getStatusDot(
  row: RosterRow,
  config: Config,
  now: number,
): { dot: string; tier: "green" | "amber" | "red" | "pulse" } {
  if (!row.live) return { dot: STATUS_DOT.dead, tier: "pulse" };
  
  const elapsedMs = row.lastActivityMs ? now - row.lastActivityMs : 0;
  const tier = elapsedTier(elapsedMs, config);
  
  switch (tier) {
    case "green":
      return { dot: STATUS_DOT.live, tier };
    case "amber":
      return { dot: STATUS_DOT.idle, tier };
    case "red":
    case "pulse":
      return { dot: STATUS_DOT.dead, tier };
  }
}

/** Format a single roster row for the widget (inside the box). */
export function formatRow(
  row: RosterRow,
  opts: {
    isCurrent: boolean;
    config: Config;
    themeFg: (color: any, text: string) => string;
    now: number;
    pulsePhase: boolean;
  },
): string {
  const { isCurrent, config, themeFg, now, pulsePhase } = opts;

  // Prefix markers
  const currentMarker = isCurrent ? config.glyphs.current : " ";
  const mainMarker = row.isMain ? config.glyphs.main : " ";

  // Status dot with color
  const { dot, tier } = getStatusDot(row, config, now);
  const coloredDot = row.live 
    ? (tier === "green" ? themeFg("success", dot) : tier === "amber" ? themeFg("warning", dot) : themeFg("dim", dot))
    : themeFg("dim", dot);

  // Name
  const name = row.name ?? row.paneId;

  // State text (working tree or "exited")
  const stateText = !row.live ? "exited" : row.workingTree ?? "";
  const coloredState = !row.live 
    ? themeFg("dim", stateText)
    : row.workingTree === "dirty" 
      ? themeFg("warning", stateText)
      : themeFg("dim", stateText);

  // Elapsed
  const elapsedMs = row.lastActivityMs ? now - row.lastActivityMs : 0;
  const elapsed = row.lastActivityMs ? formatElapsed(elapsedMs) : "";
  const coloredElapsed = row.live 
    ? colorElapsed(elapsed, tier, themeFg, pulsePhase)
    : themeFg("dim", elapsed);

  // Compose row content (without borders)
  // Format: ▶ ★ ● name  state  elapsed
  const parts = [
    currentMarker,
    mainMarker,
    coloredDot,
    " ",
    name,
    `  ${coloredState}`,
    `  ${coloredElapsed}`,
  ];

  return parts.join("");
}

/** Format a closed-pane transient row (inside the box). */
export function formatClosedRow(
  row: RosterRow,
  opts: {
    config: Config;
    themeFg: (color: any, text: string) => string;
  },
): string {
  const { config, themeFg } = opts;
  const name = row.name ?? row.paneId;
  const dot = themeFg("dim", STATUS_DOT.dead);
  
  return `   ${dot} ${themeFg("dim", name)}  ${themeFg("dim", "exited")}`;
}

/** Sort roster rows: current pinned top, then by lastActivityMs descending. */
export function sortRows(rows: RosterRow[], currentPaneId: string | null): RosterRow[] {
  return [...rows].sort((a, b) => {
    // Current pane always first
    if (a.paneId === currentPaneId) return -1;
    if (b.paneId === currentPaneId) return 1;
    // Then by lastActivityMs descending (most recent first, stale sinks)
    const aMs = a.lastActivityMs ?? 0;
    const bMs = b.lastActivityMs ?? 0;
    return bMs - aMs;
  });
}

/** Shorten a model ID for display (e.g. "anthropic/claude-sonnet-4-20250514" → "claude-sonnet-4"). */
function shortModel(model: string): string {
  // Strip provider prefix
  const parts = model.split("/");
  const id = parts.length > 1 ? parts[parts.length - 1] : model;
  // Strip date suffix (e.g. "-20250514")
  return id.replace(/-\d{8}$/, "");
}

/** Strip ANSI escape codes for length calculation. */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

/** Pad a string to a target visible width (accounting for ANSI codes). */
function padVisible(str: string, targetWidth: number): string {
  const visible = stripAnsi(str);
  const padding = Math.max(0, targetWidth - visible.length);
  return str + " ".repeat(padding);
}

/** Render the complete widget box with all rows. */
export function renderWidgetBox(
  rows: Array<{ formatted: string; isClosed: boolean }>,
  opts: {
    title: string;
    themeFg: (color: any, text: string) => string;
    width?: number;
  },
): string[] {
  const { title, themeFg, width = 50 } = opts;
  
  // Calculate inner width (between the vertical borders)
  const innerWidth = width - 4; // "│ " + content + " │"
  
  // Build the header
  const headerText = `─ ${title} `;
  const headerPad = Math.max(0, innerWidth - stripAnsi(headerText).length);
  const header = `${BOX.topLeft}${headerText}${BOX.horizontal.repeat(headerPad)}${BOX.topRight}`;
  
  // Build content rows
  const contentLines: string[] = [];
  for (const { formatted } of rows) {
    const padded = padVisible(formatted, innerWidth);
    contentLines.push(`${BOX.vertical} ${padded} ${BOX.vertical}`);
  }
  
  // Build the footer
  const footer = `${BOX.bottomLeft}${BOX.horizontal.repeat(innerWidth)}${BOX.bottomRight}`;
  
  // Combine all lines
  const lines = [
    themeFg("muted", header),
    ...contentLines.map(line => themeFg("muted", line.slice(0, 2)) + line.slice(2, -2) + themeFg("muted", line.slice(-2))),
    themeFg("muted", footer),
  ];
  
  return lines;
}

/** Render a minimal placeholder box when no agents exist. */
export function renderEmptyBox(
  themeFg: (color: any, text: string) => string,
  width: number = 50,
): string[] {
  const innerWidth = width - 4;
  const text = "No agents in herd";
  const pad = Math.max(0, innerWidth - text.length);
  const padLeft = Math.floor(pad / 2);
  const padRight = pad - padLeft;
  
  const headerText = `─ Herd `;
  const headerPad = Math.max(0, innerWidth - stripAnsi(headerText).length);
  const header = `${BOX.topLeft}${headerText}${BOX.horizontal.repeat(headerPad)}${BOX.topRight}`;
  
  const content = `${BOX.vertical}${" ".repeat(padLeft + 1)}${themeFg("dim", text)}${" ".repeat(padRight + 1)}${BOX.vertical}`;
  const footer = `${BOX.bottomLeft}${BOX.horizontal.repeat(innerWidth)}${BOX.bottomRight}`;
  
  return [
    themeFg("muted", header),
    content,
    themeFg("muted", footer),
  ];
}
