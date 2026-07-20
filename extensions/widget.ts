// Roster widget utilities — row formatting, color thresholds, sorting, pulse.
// Uses A5 (rounded corners) + A9 (accent dots) design.
// Phase 2 polish: thinking badge, detail sub-lines, pulse-vs-dim config, stale-first sort.

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
  pulseStyle: "pulse" | "dim" = "pulse",
): string {
  switch (tier) {
    case "green":
      return themeFg("success", text);
    case "amber":
      return themeFg("warning", text);
    case "red":
      return themeFg("error", text);
    case "pulse":
      // Phase 2: configurable pulse-vs-dim for the worst tier.
      if (pulseStyle === "dim") return themeFg("dim", text);
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

/** Best-effort display name: state.json name, then herdr tab label, then terminal title, then paneId. */
export function displayName(row: RosterRow): string {
  if (row.name && row.name !== row.paneId) return row.name;
  if (row.tabLabel && row.tabLabel.length > 0) return row.tabLabel;
  if (row.terminalTitle && row.terminalTitle.length > 0) return row.terminalTitle;
  return row.paneId;
}

/** Shorten thinking level for compact badge display (e.g. "high" → "🧠H"). */
function thinkingBadgeShort(t: string): string {
  const lower = t.toLowerCase();
  if (lower === "low") return "L";
  if (lower === "medium") return "M";
  if (lower === "high") return "H";
  if (lower === "extended" || lower === "xhigh") return "X";
  return t.slice(0, 1).toUpperCase();
}

/** Format a thinking badge for compact row display. Returns "" if no thinking set. (Phase 2) */
export function formatThinkingBadge(
  row: RosterRow,
  themeFg: (color: any, text: string) => string,
): string {
  if (!row.thinking) return "";
  const short = thinkingBadgeShort(row.thinking);
  return themeFg("accent", `🧠${short}`);
}

/** Shorten a filesystem path for display (keep last 2 segments). */
function shortenPath(p: string): string {
  const parts = p.split("/");
  if (parts.length <= 2) return p;
  return `…/${parts.slice(-2).join("/")}`;
}

/** Format detail sub-lines for a row (Phase 2 expanded mode).
 *  Shows role, goal, model id, thinking level, working-tree + branch, session path, warnings. */
export function formatDetailLines(
  row: RosterRow,
  opts: {
    themeFg: (color: any, text: string) => string;
  },
): string[] {
  const { themeFg } = opts;
  const muted = (s: string) => themeFg("dim", s);
  const warn = (s: string) => themeFg("warning", s);
  const lines: string[] = [];

  if (row.role) {
    lines.push(`  ${muted("role:")} ${row.role}`);
  }
  if (row.goal) {
    // Truncate long goals to ~60 chars
    const goalShort = row.goal.length > 60 ? row.goal.slice(0, 57) + "…" : row.goal;
    lines.push(`  ${muted("goal:")} ${goalShort}`);
  }
  if (row.model) {
    lines.push(`  ${muted("model:")} ${row.model}`);
  }
  if (row.thinking) {
    lines.push(`  ${muted("thinking:")} ${row.thinking}`);
  }
  const wtParts: string[] = [];
  if (row.workingTree) wtParts.push(row.workingTree);
  if (row.branch) wtParts.push(`branch ${row.branch}`);
  if (row.worktreePath) wtParts.push(shortenPath(row.worktreePath));
  if (wtParts.length > 0) {
    lines.push(`  ${muted("wt:")} ${wtParts.join(" · ")}`);
  }
  if (row.sessionPath) {
    lines.push(`  ${muted("session:")} ${shortenPath(row.sessionPath)}`);
  }
  // Phase 2: per-role isolate warning
  if (row.warnings && row.warnings.includes("isolate-expected")) {
    lines.push(`  ${warn("⚠ role expects isolation; running on shared tree")}`);
  }

  return lines;
}

/** Compose a compact single-line row (no borders).
 *  Phase 2: adds ⚠ warning for roles that expected isolation. */
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
  const name = displayName(row);

  // Thinking badge (Phase 2)
  const thinkingBadge = formatThinkingBadge(row, themeFg);

  // Phase 2: ⚠ isolate-expected warning
  const warnBadge = (row.warnings && row.warnings.includes("isolate-expected"))
    ? themeFg("warning", " ⚠")
    : "";

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
    ? colorElapsed(elapsed, tier, themeFg, pulsePhase, config.staleness.pulseStyle)
    : themeFg("dim", elapsed);

  // Compose row content (without borders)
  // Format: ▶ ★ ● name  [🧠H] ⚠  state  elapsed
  const parts = [
    currentMarker,
    mainMarker,
    coloredDot,
    " ",
    name,
    thinkingBadge ? ` ${thinkingBadge}` : "",
    warnBadge,
    `  ${coloredState}`,
    `  ${coloredElapsed}`,
  ];

  return parts.join("");
}

/** Format a closed-pane transient row (inside the box).
 *  Phase 2: shows remaining seconds before auto-removal. */
export function formatClosedRow(
  row: RosterRow,
  opts: {
    themeFg: (color: any, text: string) => string;
    remainingMs?: number;
  },
): string {
  const { themeFg, remainingMs } = opts;
  const name = displayName(row);
  const dot = themeFg("dim", STATUS_DOT.dead);

  const countdown = remainingMs != null && remainingMs > 0
    ? ` ${Math.ceil(remainingMs / 1000)}s`
    : "";

  return `   ${dot} ${themeFg("dim", name)}  ${themeFg("dim", `exited${countdown}`)}`;
}

/** Sort roster rows: current pinned top, then by lastActivityMs.
 *  `staleFirst` (Phase 2) inverts: oldest first — "what have I neglected." */
export function sortRows(
  rows: RosterRow[],
  currentPaneId: string | null,
  staleFirst = false,
): RosterRow[] {
  return [...rows].sort((a, b) => {
    // Current pane always first
    if (a.paneId === currentPaneId) return -1;
    if (b.paneId === currentPaneId) return 1;
    // Then by lastActivityMs
    const aMs = a.lastActivityMs ?? 0;
    const bMs = b.lastActivityMs ?? 0;
    // staleFirst: oldest first (asc); default: most-recent first (desc)
    return staleFirst ? aMs - bMs : bMs - aMs;
  });
}

/** Shorten a model ID for display (e.g. "anthropic/claude-sonnet-4-20250514" → "claude-sonnet-4"). */
export function shortModel(model: string): string {
  // Strip provider prefix
  const parts = model.split("/");
  const id = parts.length > 1 ? parts[parts.length - 1] : model;
  // Strip date suffix (e.g. "-20250514")
  return id.replace(/-\d{8}$/, "");
}

/** Strip ANSI escape codes for length calculation. */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m|\[\d+m/g, "");
}

/** Truncate `str` to at most `maxWidth` visible columns, appending "…" when cut.
 *  ANSI escapes are preserved — only visible characters count against the limit. */
function truncateToWidth(str: string, maxWidth: number): string {
  if (maxWidth <= 1) return "…".slice(0, maxWidth);
  let visible = 0;
  let i = 0;
  const out: string[] = [];
  while (i < str.length && visible < maxWidth - 1) {
    const ch = str[i]!;
    if (ch === "\x1b" && str[i + 1] === "[") {
      // Copy the entire escape sequence verbatim
      const start = i;
      i += 2;
      while (i < str.length && str[i] !== "m") i++;
      if (i < str.length) i++; // include the 'm'
      out.push(str.slice(start, i));
      continue;
    }
    visible++;
    out.push(ch);
    i++;
  }
  if (i >= str.length) return str;
  return out.join("") + "…";
}

/** Pad or truncate a string to exactly `targetWidth` visible columns. */
function padVisible(str: string, targetWidth: number): string {
  const visible = visibleLength(str);
  if (visible > targetWidth) return truncateToWidth(str, targetWidth);
  return str + " ".repeat(Math.max(0, targetWidth - visible));
}

/** Get visible length of a string (without ANSI codes). */
export function visibleLength(str: string): number {
  return stripAnsi(str).length;
}

/** Render the complete widget box with all rows.
 *  Each row may carry optional detail sub-lines (Phase 2 expanded mode).
 *
 *  @param width  Total available viewport width (from the TUI render callback).
 */
export function renderWidgetBox(
  rows: Array<{ formatted: string; detail: string[]; isClosed: boolean }>,
  opts: {
    title: string;
    themeFg: (color: any, text: string) => string;
    width: number;
    /** How many detail lines are visible (-1 = all, 0 = none, >0 = first N). */
    detailDepth: number;
    /** Optional right-aligned badge (e.g. "⊕ 2 unmerged"). */
    badge?: string;
  },
): string[] {
  const { title, themeFg, width, detailDepth, badge } = opts;

  const W = Math.max(20, width); // guard against tiny widths
  const borderWidth = W - 2; // between the two corner chars
  const contentWidth = W - 4; // between the two │ chars (incl. 1 pad space each side)

  // Header: ╭─ Title [mode] [badge ────] ╮
  const modeTag = detailDepth > 0 ? " detail " : "";
  const badgeTag = badge ? ` ${badge} ` : "";
  const headerText = `─ ${title}${modeTag}`;
  const headerLen = visibleLength(headerText);
  const badgeLen = visibleLength(badgeTag);
  const headerDash = Math.max(0, borderWidth - headerLen - badgeLen);
  const header = `${BOX.topLeft}${headerText}${BOX.horizontal.repeat(headerDash)}${badgeTag}${BOX.topRight}`;

  // Content rows: │ padded content │  + optional detail sub-lines
  const contentLines: string[] = [];
  for (const { formatted, detail } of rows) {
    const padded = padVisible(formatted, contentWidth);
    contentLines.push(`${BOX.vertical} ${padded} ${BOX.vertical}`);
    // Phase 2: append detail sub-lines when in detail mode
    if (detailDepth !== 0 && detail.length > 0) {
      const count = detailDepth < 0 ? detail.length : Math.min(detailDepth, detail.length);
      for (let i = 0; i < count; i++) {
        contentLines.push(`${BOX.vertical} ${padVisible(detail[i], contentWidth)} ${BOX.vertical}`);
      }
    }
  }

  // Footer: ╰────╯
  const footer = `${BOX.bottomLeft}${BOX.horizontal.repeat(borderWidth)}${BOX.bottomRight}`;

  return [header, ...contentLines, footer];
}

/** Render a minimal placeholder box when no agents exist. */
export function renderEmptyBox(
  themeFg: (color: any, text: string) => string,
  width: number,
  title = "Herd",
): string[] {
  const W = Math.max(20, width);
  const borderWidth = W - 2;
  const contentWidth = W - 4;
  const text = "No agents in herd";
  const pad = Math.max(0, contentWidth - visibleLength(text));
  const padLeft = Math.floor(pad / 2);
  const padRight = pad - padLeft;

  const headerText = `─ ${title} `;
  const headerDash = Math.max(0, borderWidth - visibleLength(headerText));
  const header = `${BOX.topLeft}${headerText}${BOX.horizontal.repeat(headerDash)}${BOX.topRight}`;

  const content = `${BOX.vertical}${" ".repeat(padLeft + 1)}${text}${" ".repeat(padRight + 1)}${BOX.vertical}`;
  const footer = `${BOX.bottomLeft}${BOX.horizontal.repeat(borderWidth)}${BOX.bottomRight}`;

  return [header, content, footer];
}
