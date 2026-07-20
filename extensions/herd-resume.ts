// /herd-resume — re-instantiate an agent shape from a saved template (Phase 2).
// Respawns with the saved role+model+thinking+goal+type. Does NOT resume a pi
// session — that's pi's native /resume. Herd resume = re-spawn the agent shape.
//
// Spawn logic mirrors herd-new's spawnNamed but reads from a template instead
// of discovering a role or parsing args.

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { getCurrentPaneInfo, createSplit, createTab, sendCommand } from "../src/herdr";
import { loadConfig } from "../src/config";
import { loadState, loadTemplate, listTemplates, writeSelfRow } from "../src/state";
import type { HerdTemplate, PaneRow } from "../src/types";

const READY_DELAY_MS = parseInt(process.env.PI_SUBAGENT_SHELL_READY_DELAY_MS ?? "1500", 10);

export function registerHerdResume(pi: ExtensionAPI, projectRoot: string, configDirName: string): void {
  pi.registerCommand("herd-resume", {
    description: "Re-spawn an agent from a saved template",
    handler: async (args, ctx) => {
      const name = args.trim();
      if (!name) {
        const templates = listTemplates(projectRoot, configDirName);
        if (templates.length === 0) {
          ctx.ui.notify("No saved templates. Use /herd-save <name> first.", "info");
        } else {
          ctx.ui.notify(`Templates: ${templates.join(", ")}`, "info");
        }
        return;
      }

      const tmpl = loadTemplate(name, projectRoot, configDirName);
      if (!tmpl) {
        const available = listTemplates(projectRoot, configDirName).join(", ");
        ctx.ui.notify(`Template "${name}" not found. Available: ${available}`, "error");
        return;
      }

      await spawnFromTemplate(ctx, tmpl, projectRoot, configDirName);
    },
  });
}

async function spawnFromTemplate(
  ctx: ExtensionCommandContext,
  tmpl: HerdTemplate,
  projectRoot: string,
  configDirName: string,
): Promise<void> {
  const id = getCurrentPaneInfo();
  if (!id) {
    ctx.ui.notify("Not running inside herdr — cannot spawn", "error");
    return;
  }

  const config = loadConfig(projectRoot, configDirName);
  const spawnName = tmpl.name;

  // Name collision check
  const existing = loadState(projectRoot, configDirName);
  if (existing.some((r) => r.name === spawnName)) {
    if (config.spawn.collisionPolicy === "auto-suffix") {
      let suffix = 2;
      while (existing.some((r) => r.name === `${spawnName}-${suffix}`)) suffix++;
      tmpl.name = `${spawnName}-${suffix}`;
    } else {
      ctx.ui.notify(`Name collision: "${spawnName}" already exists.`, "error");
      return;
    }
  }

  const childEnv: Record<string, string> = {
    HERDR_HERD_MAIN_PANE: id.paneId,
    HERDR_HERD_WIDGET: "1",
    HERD_MY_PI_NAME: spawnName,
  };

  const type = tmpl.type ?? "pane";
  const paneId =
    type === "tab"
      ? createTab({ workspaceId: id.workspaceId, cwd: projectRoot, name: spawnName, env: childEnv, focus: false })
      : createSplit({ parent: id.paneId, direction: config.spawn.defaultDirection, cwd: projectRoot, name: spawnName, env: childEnv, focus: false });

  if (!paneId) {
    ctx.ui.notify(`Failed to create ${type} for "${spawnName}"`, "error");
    return;
  }

  // Wait for pi ready, then send launch command
  setTimeout(() => {
    let piCmd = "pi";
    if (tmpl.model) piCmd += ` --model ${tmpl.model}`;
    if (tmpl.thinking) piCmd += ` --thinking ${tmpl.thinking}`;
    if (tmpl.goal) piCmd += ` --system-prompt "${escapeShell(tmpl.goal)}"`;
    sendCommand(paneId, piCmd);
  }, READY_DELAY_MS);

  const now = Date.now();
  const childRow: PaneRow = {
    paneId,
    name: spawnName,
    type,
    workspaceId: id.workspaceId,
    role: tmpl.role,
    goal: tmpl.goal,
    model: tmpl.model,
    thinking: tmpl.thinking,
    lastActivityMs: now,
    startedMs: now,
    isMain: false,
  };
  writeSelfRow(projectRoot, childRow, configDirName);

  ctx.ui.notify(`Resumed "${spawnName}" from template (${paneId})`, "info");
}

function escapeShell(s: string): string {
  return s.replace(/"/g, '\\"').replace(/\$/g, "\\$");
}
