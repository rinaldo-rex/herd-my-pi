import { describe, it, expect } from "vitest";
import {
  formatElapsed,
  elapsedTier,
  colorElapsed,
  formatRow,
  formatClosedRow,
  formatDetailLines,
  formatThinkingBadge,
  sortRows,
  renderWidgetBox,
  renderEmptyBox,
  visibleLength,
  displayName,
} from "../extensions/widget";
import { defaultConfig } from "../src/config";
import type { RosterRow } from "../src/types";

const config = defaultConfig();
const themeFg = (_color: any, text: string) => `[${_color}]${text}`;

describe("formatElapsed", () => {
  it("formats seconds", () => {
    expect(formatElapsed(5000)).toBe("5s");
    expect(formatElapsed(59000)).toBe("59s");
  });

  it("formats minutes", () => {
    expect(formatElapsed(60000)).toBe("1m");
    expect(formatElapsed(3540000)).toBe("59m");
  });

  it("formats hours", () => {
    expect(formatElapsed(3600000)).toBe("1h");
    expect(formatElapsed(5400000)).toBe("1h30m");
  });

  it("formats days", () => {
    expect(formatElapsed(86400000)).toBe("1d");
    expect(formatElapsed(172800000)).toBe("2d");
  });
});

describe("elapsedTier", () => {
  it("returns green for <2m", () => {
    expect(elapsedTier(0, config)).toBe("green");
    expect(elapsedTier(119000, config)).toBe("green");
  });

  it("returns amber for 2-10m", () => {
    expect(elapsedTier(120000, config)).toBe("amber");
    expect(elapsedTier(599000, config)).toBe("amber");
  });

  it("returns red for 10-30m", () => {
    expect(elapsedTier(600000, config)).toBe("red");
    expect(elapsedTier(1799000, config)).toBe("red");
  });

  it("returns pulse for >30m", () => {
    expect(elapsedTier(1800000, config)).toBe("pulse");
    expect(elapsedTier(3600000, config)).toBe("pulse");
  });
});

describe("colorElapsed", () => {
  it("applies correct color for each tier", () => {
    expect(colorElapsed("5s", "green", themeFg, false)).toBe("[success]5s");
    expect(colorElapsed("3m", "amber", themeFg, false)).toBe("[warning]3m");
    expect(colorElapsed("15m", "red", themeFg, false)).toBe("[error]15m");
  });

  it("pulses between error and dim (pulse style)", () => {
    expect(colorElapsed("1h", "pulse", themeFg, true, "pulse")).toBe("[error]1h");
    expect(colorElapsed("1h", "pulse", themeFg, false, "pulse")).toBe("[dim]1h");
  });

  it("uses static dim for dim style regardless of phase", () => {
    expect(colorElapsed("1h", "pulse", themeFg, true, "dim")).toBe("[dim]1h");
    expect(colorElapsed("1h", "pulse", themeFg, false, "dim")).toBe("[dim]1h");
  });
});

describe("formatThinkingBadge", () => {
  it("returns empty for no thinking", () => {
    const row: RosterRow = { paneId: "x", live: true };
    expect(formatThinkingBadge(row, themeFg)).toBe("");
  });

  it("returns short badge for known levels", () => {
    expect(formatThinkingBadge({ paneId: "x", live: true, thinking: "low" }, themeFg)).toContain("L");
    expect(formatThinkingBadge({ paneId: "x", live: true, thinking: "medium" }, themeFg)).toContain("M");
    expect(formatThinkingBadge({ paneId: "x", live: true, thinking: "high" }, themeFg)).toContain("H");
    expect(formatThinkingBadge({ paneId: "x", live: true, thinking: "extended" }, themeFg)).toContain("X");
    expect(formatThinkingBadge({ paneId: "x", live: true, thinking: "xhigh" }, themeFg)).toContain("X");
  });

  it("falls back to first char for unknown levels", () => {
    expect(formatThinkingBadge({ paneId: "x", live: true, thinking: "custom" }, themeFg)).toContain("C");
  });
});

describe("formatDetailLines", () => {
  it("shows model when set", () => {
    const row: RosterRow = { paneId: "x", live: true, model: "anthropic/claude-sonnet-4" };
    const lines = formatDetailLines(row, { themeFg });
    expect(lines.some(l => l.includes("claude-sonnet-4"))).toBe(true);
    expect(lines.some(l => l.includes("model:"))).toBe(true);
  });

  it("shows thinking when set", () => {
    const row: RosterRow = { paneId: "x", live: true, thinking: "high" };
    const lines = formatDetailLines(row, { themeFg });
    expect(lines.some(l => l.includes("high"))).toBe(true);
    expect(lines.some(l => l.includes("thinking:"))).toBe(true);
  });

  it("shows working tree details", () => {
    const row: RosterRow = {
      paneId: "x", live: true,
      workingTree: "dirty", branch: "herd-my-pi/proto", worktreePath: "/tmp/worktrees/x",
    };
    const lines = formatDetailLines(row, { themeFg });
    expect(lines.some(l => l.includes("dirty"))).toBe(true);
    expect(lines.some(l => l.includes("herd-my-pi/proto"))).toBe(true);
  });

  it("shows session path when set", () => {
    const row: RosterRow = {
      paneId: "x", live: true,
      sessionPath: "/home/user/proj/.pi/sessions/abc.jsonl",
    };
    const lines = formatDetailLines(row, { themeFg });
    expect(lines.some(l => l.includes("session:"))).toBe(true);
  });

  it("returns empty array when no extra metadata", () => {
    const row: RosterRow = { paneId: "x", live: true };
    const lines = formatDetailLines(row, { themeFg });
    expect(lines).toEqual([]);
  });
});

describe("sortRows", () => {
  const rows: RosterRow[] = [
    { paneId: "a", name: "old", lastActivityMs: 100, live: true },
    { paneId: "b", name: "current", lastActivityMs: 500, live: true },
    { paneId: "c", name: "newest", lastActivityMs: 1000, live: true },
  ];

  it("pins current pane to top", () => {
    const sorted = sortRows(rows, "b");
    expect(sorted[0].paneId).toBe("b");
  });

  it("sorts remaining by lastActivityMs descending", () => {
    const sorted = sortRows(rows, "a");
    expect(sorted[0].paneId).toBe("a"); // current
    expect(sorted[1].paneId).toBe("c"); // newest
    expect(sorted[2].paneId).toBe("b"); // oldest
  });

  it("handles missing currentPaneId", () => {
    const sorted = sortRows(rows, null);
    expect(sorted[0].paneId).toBe("c"); // newest
    expect(sorted[1].paneId).toBe("b");
    expect(sorted[2].paneId).toBe("a");
  });

  it("staleFirst inverts: oldest first after current", () => {
    const sorted = sortRows(rows, null, true);
    expect(sorted[0].paneId).toBe("a"); // oldest
    expect(sorted[1].paneId).toBe("b");
    expect(sorted[2].paneId).toBe("c"); // newest last
  });
});

describe("formatRow", () => {
  const baseRow: RosterRow = {
    paneId: "w1:p1",
    name: "scout",
    type: "pane",
    model: "anthropic/claude-sonnet-4-20250514",
    workingTree: "clean",
    lastActivityMs: Date.now() - 60000,
    isMain: false,
    live: true,
  };

  it("includes name and status dot", () => {
    const line = formatRow(baseRow, {
      isCurrent: false,
      config,
      themeFg,
      now: Date.now(),
      pulsePhase: false,
    });
    expect(line).toContain("scout");
    expect(line).toContain("●"); // live dot for green tier
  });

  it("shows current marker when isCurrent", () => {
    const line = formatRow(baseRow, {
      isCurrent: true,
      config,
      themeFg,
      now: Date.now(),
      pulsePhase: false,
    });
    expect(line).toContain(config.glyphs.current);
  });

  it("shows main marker when isMain", () => {
    const mainRow = { ...baseRow, isMain: true };
    const line = formatRow(mainRow, {
      isCurrent: false,
      config,
      themeFg,
      now: Date.now(),
      pulsePhase: false,
    });
    expect(line).toContain(config.glyphs.main);
  });

  it("shows thinking badge when set", () => {
    const thinkRow = { ...baseRow, thinking: "high" };
    const line = formatRow(thinkRow, {
      isCurrent: false,
      config,
      themeFg,
      now: Date.now(),
      pulsePhase: false,
    });
    expect(line).toContain("[accent]");
  });

  it("shows working tree state", () => {
    const dirtyRow = { ...baseRow, workingTree: "dirty" as const };
    const line = formatRow(dirtyRow, {
      isCurrent: false,
      config,
      themeFg,
      now: Date.now(),
      pulsePhase: false,
    });
    expect(line).toContain("dirty");
  });

  it("shows exited state for dead panes", () => {
    const deadRow = { ...baseRow, live: false };
    const line = formatRow(deadRow, {
      isCurrent: false,
      config,
      themeFg,
      now: Date.now(),
      pulsePhase: false,
    });
    expect(line).toContain("exited");
    expect(line).toContain("○"); // dead dot
  });
});

describe("formatClosedRow", () => {
  it("shows exited label with dead dot", () => {
    const row: RosterRow = {
      paneId: "w1:p1",
      name: "scout",
      type: "pane",
      live: false,
    };
    const line = formatClosedRow(row, { themeFg });
    expect(line).toContain("scout");
    expect(line).toContain("exited");
    expect(line).toContain("○");
  });

  it("shows remaining seconds countdown", () => {
    const row: RosterRow = { paneId: "w1:p1", name: "scout", type: "pane", live: false };
    const line = formatClosedRow(row, { themeFg, remainingMs: 3200 });
    expect(line).toContain("exited 4s");
  });

  it("omits countdown when remainingMs not provided", () => {
    const row: RosterRow = { paneId: "w1:p1", name: "scout", type: "pane", live: false };
    const line = formatClosedRow(row, { themeFg });
    expect(line).toContain("exited");
    // No digit after "exited"
    expect(line).not.toMatch(/exited \d/);
  });
});

describe("displayName", () => {
  it("returns name when set and different from paneId", () => {
    const row: RosterRow = { paneId: "x", name: "scout", live: true };
    expect(displayName(row)).toBe("scout");
  });

  it("falls back to tabLabel", () => {
    const row: RosterRow = { paneId: "x", name: "x", tabLabel: "My Tab", live: true };
    expect(displayName(row)).toBe("My Tab");
  });

  it("falls back to terminalTitle", () => {
    const row: RosterRow = { paneId: "x", terminalTitle: "bash", live: true };
    expect(displayName(row)).toBe("bash");
  });

  it("falls back to paneId", () => {
    const row: RosterRow = { paneId: "x", live: true };
    expect(displayName(row)).toBe("x");
  });
});

describe("renderWidgetBox", () => {
  it("renders a box with rounded corners", () => {
    const rows = [
      { formatted: "▶ ★ ● scout  clean  5s", detail: [], isClosed: false },
      { formatted: "  ★ ● proto  dirty  3m", detail: [], isClosed: false },
    ];
    const lines = renderWidgetBox(rows, { title: "Herd", themeFg, width: 80, detailDepth: 0 });
    
    // Should have header + 2 rows + footer = 4 lines
    expect(lines).toHaveLength(4);
    
    // Check corners
    expect(lines[0]).toContain("╭");
    expect(lines[0]).toContain("╮");
    expect(lines[3]).toContain("╰");
    expect(lines[3]).toContain("╯");
    
    // Check vertical borders
    expect(lines[1]).toContain("│");
    expect(lines[2]).toContain("│");
  });

  it("includes title in header", () => {
    const rows = [{ formatted: "test", detail: [], isClosed: false }];
    const lines = renderWidgetBox(rows, { title: "Herd", themeFg, width: 80, detailDepth: 0 });
    expect(lines[0]).toContain("Herd");
  });

  it("all lines have the same visible width", () => {
    const rows = [
      { formatted: themeFg("success", "●") + " scout  clean  5s", detail: [], isClosed: false },
      { formatted: themeFg("warning", "◐") + " proto  dirty  3m", detail: [], isClosed: false },
      { formatted: themeFg("dim", "○") + " old    exited 2h", detail: [], isClosed: false },
    ];
    const lines = renderWidgetBox(rows, { title: "Herd", themeFg, width: 80, detailDepth: 0 });
    
    const widths = lines.map(l => visibleLength(l));
    // 3 rows + header + footer = 5 lines, all exactly 80 visible chars wide
    expect(widths).toEqual([80, 80, 80, 80, 80]);
    expect(new Set(widths).size).toBe(1);
  });

  it("respects the passed width", () => {
    const rows = [{ formatted: "scout  clean  5s", detail: [], isClosed: false }];
    const lines = renderWidgetBox(rows, { title: "Herd", themeFg, width: 40, detailDepth: 0 });
    const widths = lines.map(l => visibleLength(l));
    expect(new Set(widths).size).toBe(1);
    expect(widths[0]).toBe(40);
  });

  it("includes detail sub-lines when detailDepth > 0", () => {
    const rows = [
      { formatted: "scout  clean  5s", detail: ["  model: x", "  wt: clean"], isClosed: false },
    ];
    const lines = renderWidgetBox(rows, { title: "Herd", themeFg, width: 40, detailDepth: 1 });
    // header + row + 1 detail + footer = 4 lines
    expect(lines).toHaveLength(4);
    expect(lines.some(l => l.includes("model:"))).toBe(true);
  });

  it("includes all detail sub-lines when detailDepth < 0", () => {
    const rows = [
      { formatted: "scout", detail: ["  a", "  b", "  c"], isClosed: false },
    ];
    const lines = renderWidgetBox(rows, { title: "Herd", themeFg, width: 40, detailDepth: -1 });
    // header + row + 3 detail + footer = 6 lines
    expect(lines).toHaveLength(6);
  });

  it("shows mode tag in header in detail mode", () => {
    const rows = [{ formatted: "test", detail: ["  a"], isClosed: false }];
    const lines = renderWidgetBox(rows, { title: "Herd", themeFg, width: 40, detailDepth: 1 });
    expect(lines[0]).toContain("detail");
  });

  it("truncates overlong detail lines to fit the box", () => {
    const longLine = "  " + "x".repeat(120);
    const rows = [{ formatted: "scout", detail: [longLine], isClosed: false }];
    const lines = renderWidgetBox(rows, { title: "Herd", themeFg, width: 40, detailDepth: 1 });
    // Every line must be exactly 40 visible chars
    for (const l of lines) {
      expect(visibleLength(l)).toBe(40);
    }
    expect(lines[2]).toContain("…");
  });

  it("truncates overlong main row to fit the box", () => {
    const veryLong = "x".repeat(100);
    const rows = [{ formatted: veryLong, detail: [], isClosed: false }];
    const lines = renderWidgetBox(rows, { title: "Herd", themeFg, width: 40, detailDepth: 0 });
    for (const l of lines) {
      expect(visibleLength(l)).toBe(40);
    }
    expect(lines[1]).toContain("…");
  });
});

describe("renderEmptyBox", () => {
  it("renders placeholder when no agents", () => {
    const lines = renderEmptyBox(themeFg, 80);
    
    // Should have header + 1 content + footer = 3 lines
    expect(lines).toHaveLength(3);
    
    // Check for placeholder text
    expect(lines[1]).toContain("No agents in herd");
    
    // Check corners
    expect(lines[0]).toContain("╭");
    expect(lines[2]).toContain("╰");
  });
});
