// /herd-merge + /herd-discard — worktree lifecycle (Phase 2).
// Wraps `wt merge` and `wt remove` respectively. Resolves agent name →
// herd-my-pi/<name> branch from state.json. Requires `wt` on PATH.

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { loadState as loadRows } from "../src/state";
import { isWtAvailable, wtMerge, wtRemove } from "../src/herdr";

export function registerHerdWorktree(pi: ExtensionAPI, projectRoot: string, configDirName: string): void {
  pi.registerCommand("herd-merge", {
    description: "Merge an isolated agent's worktree back (wraps wt merge)",
    handler: async (args, ctx) => {
      const name = args.trim();
      if (!name) {
        ctx.ui.notify("Usage: /herd-merge <name>", "warning");
        return;
      }
      await handleMerge(ctx, name, projectRoot, configDirName);
    },
  });

  pi.registerCommand("herd-discard", {
    description: "Discard an isolated agent's worktree (wraps wt remove)",
    handler: async (args, ctx) => {
      const name = args.trim();
      if (!name) {
        ctx.ui.notify("Usage: /herd-discard <name>", "warning");
        return;
      }
      await handleDiscard(ctx, name, projectRoot, configDirName);
    },
  });
}

async function handleMerge(
  ctx: ExtensionCommandContext,
  name: string,
  projectRoot: string,
  configDirName: string,
): Promise<void> {
  if (!isWtAvailable()) {
    ctx.ui.notify("wt (Worktrunk) not found. Install it to merge worktrees.", "error");
    return;
  }

  const rows = loadRows(projectRoot, configDirName);
  const agent = rows.find((r) => r.name === name);
  if (!agent) {
    ctx.ui.notify(`Agent "${name}" not found in roster`, "error");
    return;
  }

  const branch = agent.branch;
  if (!branch) {
    ctx.ui.notify(`"${name}" was not spawned with --isolate — nothing to merge`, "warning");
    return;
  }

  ctx.ui.notify(`Merging ${branch}...`, "info");
  const result = wtMerge(branch);
  if (result.ok) {
    ctx.ui.notify(`Merged ${branch}: ${result.stdout.trim() || "done"}`, "info");
  } else {
    ctx.ui.notify(`Merge failed: ${result.stderr.trim() || "unknown error"}`, "error");
  }
}

async function handleDiscard(
  ctx: ExtensionCommandContext,
  name: string,
  projectRoot: string,
  configDirName: string,
): Promise<void> {
  if (!isWtAvailable()) {
    ctx.ui.notify("wt (Worktrunk) not found. Install it to discard worktrees.", "error");
    return;
  }

  const rows = loadRows(projectRoot, configDirName);
  const agent = rows.find((r) => r.name === name);
  if (!agent) {
    ctx.ui.notify(`Agent "${name}" not found in roster`, "error");
    return;
  }

  const branch = agent.branch;
  if (!branch) {
    ctx.ui.notify(`"${name}" was not spawned with --isolate — nothing to discard`, "warning");
    return;
  }

  ctx.ui.notify(`Discarding ${branch}...`, "info");
  const result = wtRemove(branch);
  if (result.ok) {
    ctx.ui.notify(`Discarded ${branch}: ${result.stdout.trim() || "done"}`, "info");
  } else {
    ctx.ui.notify(`Discard failed: ${result.stderr.trim() || "unknown error"}`, "error");
  }
}
