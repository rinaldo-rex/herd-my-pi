import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { HerdrPane, PaneRow } from "../src/types";
import {
  loadState,
  readRoster,
  removeSelfRow,
  saveState,
  stateFilePath,
  writeSelfRow,
} from "../src/state";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "herd-my-pi-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function row(overrides: Partial<PaneRow> & { paneId: string }): PaneRow {
  return {
    name: overrides.paneId,
    type: "pane",
    workspaceId: "w13",
    workingTree: null,
    lastActivityMs: Date.now(),
    startedMs: Date.now(),
    isMain: false,
    ...overrides,
  };
}

describe("state IO", () => {
  it("loadState returns [] when absent", () => {
    expect(loadState(root)).toEqual([]);
  });

  it("loadState recovers from malformed JSON", () => {
    const file = stateFilePath(root);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, "{ not json", "utf8");
    expect(loadState(root)).toEqual([]);
  });

  it("saveState/loadState round-trips", () => {
    const rows = [row({ paneId: "w13:p1", name: "scout", model: "gpt-x" })];
    saveState(root, rows);
    expect(loadState(root)).toEqual(rows);
  });

  it("writeSelfRow inserts then updates by paneId (new values win)", () => {
    writeSelfRow(root, row({ paneId: "w13:p1", name: "scout", model: "gpt-a", workingTree: null }));
    writeSelfRow(root, row({ paneId: "w13:p1", name: "scout", model: "gpt-x", workingTree: "dirty" }));
    const rows = loadState(root);
    expect(rows).toHaveLength(1); // updated, not duplicated
    expect(rows[0].name).toBe("scout");
    expect(rows[0].model).toBe("gpt-x"); // new value wins
    expect(rows[0].workingTree).toBe("dirty");
  });

  it("writeSelfRow from many peers lands all rows (last-writer per row)", async () => {
    const panes = ["p1", "p2", "p3", "p4", "p5"].map((p) => `w13:${p}`);
    // Serialize is unnecessary — last-writer per paneId; concurrent writes of
    // DISTINCT paneIds should all survive the atomic-rename dance.
    await Promise.all(
      panes.map((paneId) =>
        Promise.resolve(writeSelfRow(root, row({ paneId, name: paneId }))),
      ),
    );
    const rows = loadState(root);
    expect(rows.map((r) => r.paneId).sort()).toEqual(panes);
  });

  it("removeSelfRow drops only the target", () => {
    writeSelfRow(root, row({ paneId: "w13:p1" }));
    writeSelfRow(root, row({ paneId: "w13:p2" }));
    removeSelfRow(root, "w13:p1");
    const rows = loadState(root);
    expect(rows).toHaveLength(1);
    expect(rows[0].paneId).toBe("w13:p2");
  });
});

describe("readRoster join (D26)", () => {
  it("JOINs live panes with herd rows; marks missing as live:false", () => {
    writeSelfRow(root, row({ paneId: "w13:p1", name: "scout", model: "gpt-x", isMain: true }));
    writeSelfRow(root, row({ paneId: "w13:p9", name: "ghost", startedMs: 1 })); // exited

    const provider = (_ws: string): HerdrPane[] => [
      {
        pane_id: "w13:p1",
        tab_id: "w13:t1",
        workspace_id: "w13",
        agent: "pi",
        agent_status: "working",
        cwd: "/repo",
        focused: true,
        agent_session: { value: "/s/scout.jsonl" },
      },
      {
        pane_id: "w13:p4",
        tab_id: "w13:t1",
        workspace_id: "w13",
        agent_status: "unknown",
        cwd: "/repo",
        focused: false,
      },
    ];

    const roster = readRoster("w13", root, ".pi", provider);
    // two live + one exited
    expect(roster).toHaveLength(3);

    const byId = new Map(roster.map((r) => [r.paneId, r]));
    // live + joined
    expect(byId.get("w13:p1")?.live).toBe(true);
    expect(byId.get("w13:p1")?.name).toBe("scout");
    expect(byId.get("w13:p1")?.model).toBe("gpt-x");
    expect(byId.get("w13:p1")?.agent).toBe("pi");
    expect(byId.get("w13:p1")?.agentStatus).toBe("working");
    expect(byId.get("w13:p1")?.cwd).toBe("/repo");
    expect(byId.get("w13:p1")?.sessionPath).toBe("/s/scout.jsonl");
    expect(byId.get("w13:p1")?.isMain).toBe(true);
    expect(byId.get("w13:p1")?.focused).toBe(true);

    // live but no herd row (a plain shell pane) — herd fields undefined
    expect(byId.get("w13:p4")?.live).toBe(true);
    expect(byId.get("w13:p4")?.name).toBeUndefined();
    expect(byId.get("w13:p4")?.agent).toBeUndefined();
    expect(byId.get("w13:p4")?.agentStatus).toBe("unknown");

    // exited (in state.json, missing from live)
    expect(byId.get("w13:p9")?.live).toBe(false);
    expect(byId.get("w13:p9")?.name).toBe("ghost");
  });

  it("readRoster with no live panes returns all rows as live:false", () => {
    writeSelfRow(root, row({ paneId: "w13:p1", name: "solo" }));
    const roster = readRoster("w13", root, ".pi", () => []);
    expect(roster).toHaveLength(1);
    expect(roster[0].live).toBe(false);
    expect(roster[0].name).toBe("solo");
  });
});
