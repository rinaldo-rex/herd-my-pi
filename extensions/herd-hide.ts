// /herd-hide + /herd-unhide — noise control (Phase 2).
// Hides/shows rows on the roster by name. Hidden set persists in state.json
// per-workspace. Does NOT close or kill panes — only suppresses display.

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { hidePane, unhidePane } from "../src/state";

export function registerHerdHide(pi: ExtensionAPI, projectRoot: string, configDirName: string): void {
  pi.registerCommand("herd-hide", {
    description: "Hide an agent from the roster",
    handler: async (args, ctx) => {
      const name = args.trim();
      if (!name) {
        ctx.ui.notify("Usage: /herd-hide <name>", "warning");
        return;
      }
      const paneId = hidePane(projectRoot, name, configDirName);
      if (paneId) {
        ctx.ui.notify(`Hidden "${name}" from roster`, "info");
      } else {
        ctx.ui.notify(`Agent "${name}" not found in roster`, "error");
      }
    },
  });

  pi.registerCommand("herd-unhide", {
    description: "Restore a hidden agent to the roster",
    handler: async (args, ctx) => {
      const name = args.trim();
      if (!name) {
        ctx.ui.notify("Usage: /herd-unhide <name>", "warning");
        return;
      }
      const paneId = unhidePane(projectRoot, name, configDirName);
      if (paneId) {
        ctx.ui.notify(`Restored "${name}" to roster`, "info");
      } else {
        ctx.ui.notify(`Agent "${name}" not found in hidden set`, "error");
      }
    },
  });
}
