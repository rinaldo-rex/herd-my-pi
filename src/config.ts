import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Config, HERD_DIR_NAME } from "./types";

// Package defaults — the single runtime source of truth. The shippable
// `config.json` is a copy of this, seeded into `.pi/herd-my-pi/config.json` by
// `/herd-init` (Phase 1). Keep them in sync.
const DEFAULTS: Config = {
  version: 1,
  glyphs: { agentFilled: "◆", agentOutline: "◇", current: "▶", main: "★" },
  staleness: { amberMs: 120_000, redMs: 600_000, pulseMs: 1_800_000, pulseStyle: "pulse" },
  intervals: { heartbeatMs: 2_000, widgetRefreshMs: 1_000, closedPaneLingerMs: 5_000 },
  spawn: { defaultDirection: "right", collisionPolicy: "error" },
  worktrees: { autoDiscardOnClose: false, branchPrefix: "herd-my-pi/" },
  widget: { showDetail: false, staleFirst: false },
};

export function defaultConfig(): Config {
  return structuredClone(DEFAULTS);
}

/**
 * Merge a user `.pi/herd-my-pi/config.json` (partial) over package defaults.
 * `configDirName` defaults to `.pi`; the extension entry passes the host's
 * `CONFIG_DIR_NAME` constant (don't hardcode `.pi`). Absent or malformed user
 * files fall back to defaults (never throw).
 */
export function loadConfig(projectRoot: string, configDirName = ".pi"): Config {
  const merged = defaultConfig();
  const userPath = join(projectRoot, configDirName, HERD_DIR_NAME, "config.json");
  let text: string | null = null;
  try {
    text = readFileSync(userPath, "utf8");
  } catch {
    return merged; // absent: use defaults
  }
  let user: Partial<Config>;
  try {
    user = JSON.parse(text) as Partial<Config>;
  } catch {
    return merged; // malformed: use defaults
  }
  return mergeConfig(merged, user);
}

function mergeConfig(base: Config, user: Partial<Config>): Config {
  return {
    ...base,
    ...user,
    glyphs: { ...base.glyphs, ...(user.glyphs ?? {}) },
    staleness: { ...base.staleness, ...(user.staleness ?? {}) },
    intervals: { ...base.intervals, ...(user.intervals ?? {}) },
    spawn: { ...base.spawn, ...(user.spawn ?? {}) },
    worktrees: { ...base.worktrees, ...(user.worktrees ?? {}) },
    widget: { ...base.widget, ...(user.widget ?? {}) },
  };
}
