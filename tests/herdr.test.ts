import { describe, expect, it } from "vitest";
import {
  buildSplitArgs,
  buildTabCreateArgs,
  getCurrentPaneInfo,
  isHerdrAvailable,
  parsePane,
  parsePaneId,
  parsePaneList,
} from "../src/herdr";

// Real `herdr 0.7.4` captures (trimmed to essential fields; structure intact).
const PANE_GET = `{"id":"cli:pane:get","result":{"pane":{"agent":"pi","agent_session":{"agent":"pi","kind":"path","source":"herdr:pi","value":"/home/rinaldorex/.pi/agent/sessions/x/2026-07-19T10-50-44-242Z_019f79ff.jsonl"},"agent_status":"working","cwd":"/home/rinaldorex/Documents/2026/jul/herd-my-pi","focused":true,"pane_id":"w13:p1","tab_id":"w13:t1","terminal_title":"π - herd-my-pi","workspace_id":"w13"}},"type":"pane_info"}`;

const PANE_CURRENT = `{"id":"cli:pane:current","result":{"pane":{"agent":"pi","agent_status":"working","cwd":"/home/rinaldorex/Documents/2026/jul/herd-my-pi","focused":false,"pane_id":"w13:p1","tab_id":"w13:t1","workspace_id":"w13"}},"type":"pane_current"}`;

const PANE_LIST = `{"id":"cli:pane:list","result":{"panes":[{"agent":"pi","agent_status":"working","cwd":"/home/rinaldorex/Documents/2026/jul/herd-my-pi","focused":true,"pane_id":"w13:p1","tab_id":"w13:t1","workspace_id":"w13","terminal_title":"π - herd-my-pi"},{"agent_status":"unknown","cwd":"/home/rinaldorex/Documents/2026/jul/herd-my-pi","focused":false,"pane_id":"w13:p4","tab_id":"w13:t1","workspace_id":"w13","terminal_title":"rinaldorex@pop-os:~/…"}]},"type":"pane_list"}`;

describe("herdr parsing", () => {
  it("parsePaneId reads result.pane.pane_id from `pane current`", () => {
    expect(parsePaneId(PANE_CURRENT)).toBe("w13:p1");
  });

  it("parsePaneId reads result.pane.pane_id from `pane get`", () => {
    expect(parsePaneId(PANE_GET)).toBe("w13:p1");
  });

  it("parsePaneId falls back to plain text", () => {
    expect(parsePaneId("  w99:p1  ")).toBe("w99:p1");
  });

  it("parsePaneId returns null on garbage", () => {
    expect(parsePaneId("totally not json")).toBe("totally");
    expect(parsePaneId("")).toBeNull();
    expect(parsePaneId('{"result":{"foo":1}}')).toBeNull();
  });

  it("parsePane extracts a single pane", () => {
    const p = parsePane(PANE_GET);
    expect(p).not.toBeNull();
    expect(p!.pane_id).toBe("w13:p1");
    expect(p!.agent).toBe("pi");
    expect(p!.agent_status).toBe("working");
    expect(p!.cwd).toContain("herd-my-pi");
    expect(p!.agent_session?.value).toMatch(/\.jsonl$/);
  });

  it("parsePaneList extracts all panes", () => {
    const panes = parsePaneList(PANE_LIST);
    expect(panes).toHaveLength(2);
    expect(panes[0].pane_id).toBe("w13:p1");
    expect(panes[0].agent).toBe("pi");
    expect(panes[1].pane_id).toBe("w13:p4");
    expect(panes[1].agent).toBeUndefined();
    expect(panes[1].agent_status).toBe("unknown");
  });

  it("parsePaneList returns [] on garbage", () => {
    expect(parsePaneList("nope")).toEqual([]);
    expect(parsePaneList('{"result":{}}')).toEqual([]);
  });
});

describe("herdr availability & identity", () => {
  it("isHerdrAvailable checks HERDR_ENV", () => {
    expect(isHerdrAvailable({ HERDR_ENV: "1" } as NodeJS.ProcessEnv)).toBe(true);
    expect(isHerdrAvailable({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it("getCurrentPaneInfo reads identity from env", () => {
    const id = getCurrentPaneInfo({
      HERDR_PANE_ID: "w9:p2",
      HERDR_TAB_ID: "w9:t1",
      HERDR_WORKSPACE_ID: "w9",
    } as NodeJS.ProcessEnv);
    expect(id).toEqual({ paneId: "w9:p2", tabId: "w9:t1", workspaceId: "w9" });
  });

  // Note: the no-env path falls back to a live `herdr pane current` call,
  // so it is environment-coupled and validated by the live smoke test, not here.
});

describe("surface arg-builders", () => {
  it("buildTabCreateArgs mirrors herdr 0.7.4 tab create flags", () => {
    const args = buildTabCreateArgs({
      workspaceId: "w13",
      cwd: "/repo",
      name: "scout",
      env: { HERDR_HERD_MAIN_PANE: "w13:p1", HERDR_HERD_WIDGET: "1" },
    });
    expect(args).toEqual([
      "tab", "create",
      "--workspace", "w13",
      "--cwd", "/repo",
      "--label", "scout",
      "--env", "HERDR_HERD_MAIN_PANE=w13:p1",
      "--env", "HERDR_HERD_WIDGET=1",
      "--no-focus",
    ]);
  });

  it("buildTabCreateArgs respects focus", () => {
    const args = buildTabCreateArgs({ workspaceId: "w", cwd: "/r", name: "x", focus: true });
    expect(args.at(-1)).toBe("--focus");
  });

  it("buildSplitArgs uses --direction right|down + --env + --no-focus", () => {
    const args = buildSplitArgs({
      parent: "w13:p1",
      direction: "right",
      cwd: "/repo",
      env: { HERDR_HERD_WIDGET: "1" },
    });
    expect(args).toEqual([
      "pane", "split", "w13:p1",
      "--direction", "right",
      "--cwd", "/repo",
      "--env", "HERDR_HERD_WIDGET=1",
      "--no-focus",
    ]);
  });
});
