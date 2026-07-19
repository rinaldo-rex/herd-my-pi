// Roster widget utilities — row formatting, color thresholds, sorting, pulse.
// Used by the /herd command to render the display-only roster widget.

import type { Config, RosterRow } from "../src/types";

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

/** Format a single roster row for the widget. */
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
  const currentMarker = isCurrent ? config.glyphs.current + " " : "  ";
  const mainMarker = row.isMain ? config.glyphs.main + " " : "  ";

  // Surface glyph
  const glyph = row.type === "tab" ? config.glyphs.agentFilled : config.glyphs.agentOutline;

  // Name
  const name = row.name ?? row.paneId;

  // Model badge (short form)
  const model = row.model ? shortModel(row.model) : "";

  // Working tree indicator
  const wt = row.workingTree === "dirty" ? "●" : row.workingTree === "clean" ? "○" : "";

  // Branch name (if isolated)
  const branch = row.branch ? `(${row.branch})` : "";

  // Elapsed
  const elapsedMs = row.lastActivityMs ? now - row.lastActivityMs : 0;
  const elapsed = row.lastActivityMs ? formatElapsed(elapsedMs) : "";
  const tier = row.lastActivityMs ? elapsedTier(elapsedMs, config) : "green";
  const coloredElapsed = colorElapsed(elapsed, tier, themeFg, pulsePhase);

  // Compose row
  const parts = [
    currentMarker,
    mainMarker,
    glyph,
    " ",
    name,
    model ? `  ${themeFg("muted", model)}` : "",
    wt ? `  ${wt}` : "",
    branch ? `  ${themeFg("dim", branch)}` : "",
    elapsed ? `  ${coloredElapsed}` : "",
  ];

  return parts.join("");
}

/** Format a closed-pane transient row ("X exited"). */
export function formatClosedRow(
  row: RosterRow,
  opts: {
    config: Config;
    themeFg: (color: any, text: string) => string;
  },
): string {
  const { config, themeFg } = opts;
  const glyph = row.type === "tab" ? config.glyphs.agentFilled : config.glyphs.agentOutline;
  const name = row.name ?? row.paneId;
  return `  ${glyph} ${themeFg("dim", name)}  ${themeFg("error", "exited")}`;
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
