// Heartbeat & self-update. Per the extension docs, timers must NOT start in the
// factory — only inside `session_start` — and must be stopped in
// `session_shutdown`. extensions/index.ts wires that.

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { PaneRow } from "./types";
import { writeSelfRow } from "./state";

export interface Heartbeat {
  stop: () => void;
}

export interface WorkingTreeStatus {
  state: "clean" | "dirty" | null;
  branch?: string;
}

/** Cheap `git status --short` + current branch. `null` state if not a git repo. */
export function workingTreeStatus(cwd: string = process.cwd()): WorkingTreeStatus {
  // Cheap git-ness gate (a worktree has a `.git` file, a repo has a `.git` dir).
  if (!existsSync(join(cwd, ".git"))) {
    return { state: null };
  }
  try {
    const status = execSync("git status --short", {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    let branch: string | undefined;
    try {
      branch =
        execSync("git rev-parse --abbrev-ref HEAD", {
          cwd,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim() || undefined;
    } catch {
      // detached HEAD etc. — leave branch undefined
    }
    return { state: status ? "dirty" : "clean", branch };
  } catch {
    return { state: null };
  }
}

export interface StartHeartbeatOpts {
  projectRoot: string;
  configDirName?: string;
  intervalMs: number;
  /** Mutated in place across ticks so each tick builds on the previous self. */
  self: PaneRow;
  onTick?: (row: PaneRow) => void;
}

export function startHeartbeat(opts: StartHeartbeatOpts): Heartbeat {
  const configDirName = opts.configDirName ?? ".pi";
  const tick = () => {
    const wt = workingTreeStatus();
    const row: PaneRow = {
      ...opts.self,
      workingTree: wt.state,
      branch: wt.branch ?? opts.self.branch,
      lastActivityMs: Date.now(),
    };
    opts.onTick?.(row);
    writeSelfRow(opts.projectRoot, row, configDirName);
    opts.self.lastActivityMs = row.lastActivityMs;
    opts.self.workingTree = row.workingTree;
    opts.self.branch = row.branch;
  };
  tick(); // initial write immediately
  const handle = setInterval(tick, Math.max(500, opts.intervalMs));
  // Don't keep the event loop alive solely for the heartbeat — let pi exit.
  if (typeof (handle as { unref?: () => void }).unref === "function") {
    (handle as { unref: () => void }).unref();
  }
  return {
    stop: () => clearInterval(handle),
  };
}
