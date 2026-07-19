import { describe, it, expect } from "vitest";
import {
  formatElapsed,
  elapsedTier,
  colorElapsed,
  formatRow,
  formatClosedRow,
  sortRows,
  renderWidgetBox,
  renderEmptyBox,
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

  it("pulses between error and dim", () => {
    expect(colorElapsed("1h", "pulse", themeFg, true)).toBe("[error]1h");
    expect(colorElapsed("1h", "pulse", themeFg, false)).toBe("[dim]1h");
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
    const line = formatClosedRow(row, { config, themeFg });
    expect(line).toContain("scout");
    expect(line).toContain("exited");
    expect(line).toContain("○");
  });
});

describe("renderWidgetBox", () => {
  it("renders a box with rounded corners", () => {
    const rows = [
      { formatted: "▶ ★ ● scout  clean  5s", isClosed: false },
      { formatted: "  ★ ● proto  dirty  3m", isClosed: false },
    ];
    const lines = renderWidgetBox(rows, { title: "Herd", themeFg });
    
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
    const rows = [{ formatted: "test", isClosed: false }];
    const lines = renderWidgetBox(rows, { title: "Herd", themeFg });
    expect(lines[0]).toContain("Herd");
  });
});

describe("renderEmptyBox", () => {
  it("renders placeholder when no agents", () => {
    const lines = renderEmptyBox(themeFg);
    
    // Should have header + 1 content + footer = 3 lines
    expect(lines).toHaveLength(3);
    
    // Check for placeholder text
    expect(lines[1]).toContain("No agents in herd");
    
    // Check corners
    expect(lines[0]).toContain("╭");
    expect(lines[2]).toContain("╰");
  });
});
