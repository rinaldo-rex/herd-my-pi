// /herd-save — persist the current pane's agent shape as a template (Phase 2).
// Saves role + model + thinking + goal + type to .pi/herd-my-pi/templates/<name>.json.
// NOT a pi agent definition — just the spawn-time choices (D2).

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { loadState, saveTemplate } from "../src/state";
import { getCurrentPaneInfo } from "../src/herdr";
import type { HerdTemplate } from "../src/types";

export function registerHerdSave(pi: ExtensionAPI, projectRoot: string, configDirName: string): void {
  pi.registerCommand("herd-save", {
    description: "Save the current pane's agent shape as a reusable template",
    handler: async (args, ctx) => {
      const name = args.trim();
      if (!name) {
        ctx.ui.notify("Usage: /herd-save <name>", "warning");
        return;
      }
      await handleSave(ctx, name, projectRoot, configDirName);
    },
  });
}

async function handleSave(
  ctx: ExtensionCommandContext,
  name: string,
  projectRoot: string,
  configDirName: string,
): Promise<void> {
  const id = getCurrentPaneInfo();
  if (!id) {
    ctx.ui.notify("Not running inside herdr — nothing to save", "error");
    return;
  }

  // Read the current pane's state row
  const rows = loadState(projectRoot, configDirName);
  const self = rows.find((r) => r.paneId === id.paneId);
  if (!self) {
    ctx.ui.notify("Current pane not found in roster", "error");
    return;
  }

  const tmpl: HerdTemplate = {
    name,
    role: self.role,
    model: self.model,
    thinking: self.thinking,
    goal: self.goal,
    type: self.type,
  };

  saveTemplate(tmpl, projectRoot, configDirName);
  ctx.ui.notify(`Saved template "${name}"`, "info");
}
