import { describe, it, expect } from "vitest";
import {
  formatElapsed,
  elapsedTier,
  colorElapsed,
  formatRow,
  formatClosedRow,
  sortRows,
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

  it("includes name and model", () => {
    const line = formatRow(baseRow, {
      isCurrent: false,
      config,
      themeFg,
      now: Date.now(),
      pulsePhase: false,
    });
    expect(line).toContain("scout");
    expect(line).toContain("claude-sonnet-4");
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

  it("shows branch when set", () => {
    const isolatedRow = { ...baseRow, branch: "herd-my-pi/proto" };
    const line = formatRow(isolatedRow, {
      isCurrent: false,
      config,
      themeFg,
      now: Date.now(),
      pulsePhase: false,
    });
    expect(line).toContain("(herd-my-pi/proto)");
  });
});

describe("formatClosedRow", () => {
  it("shows exited label", () => {
    const row: RosterRow = {
      paneId: "w1:p1",
      name: "scout",
      type: "pane",
      live: false,
    };
    const line = formatClosedRow(row, { config, themeFg });
    expect(line).toContain("scout");
    expect(line).toContain("exited");
  });
});
