// herd-my-pi — Phase 1 entry point.
//
// Wires all Phase 1 commands and the display-only roster widget.
// On session_start: write this instance's own state row + start the heartbeat.
// On session_shutdown: stop heartbeat + stop widget + drop our row.
//
// Runs inside pi via jiti (TS, no build). `@earendil-works/pi-coding-agent` is
// provided by the host — listed as a peerDependency.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { getCurrentPaneInfo } from "../src/herdr";
import { loadConfig } from "../src/config";
import { removeSelfRow, writeSelfRow } from "../src/state";
import { startHeartbeat, type Heartbeat } from "../src/heartbeat";
import type { PaneRow } from "../src/types";

// Phase 1 commands
import { registerHerdInit } from "./herd-init";
import { registerHerdNew } from "./herd-new";
import { registerHerdPush } from "./herd-push";
import { registerHerdPull, registerHerdReceivePull } from "./herd-pull";
import { registerHerd, maybeAutoShowWidget, stopWidgetOnShutdown, type WidgetState } from "./herd";

export default function (pi: ExtensionAPI): void {
  let heartbeat: Heartbeat | null = null;
  let widgetState: WidgetState | null = null;

  const projectRoot = process.cwd(); // Will be overridden by ctx.cwd on session_start
  let configDirName = CONFIG_DIR_NAME;

  // Register all commands
  registerHerdInit(pi);
  registerHerdNew(pi, projectRoot, configDirName);
  registerHerdPush(pi, projectRoot, configDirName);
  registerHerdPull(pi, projectRoot, configDirName);
  registerHerdReceivePull(pi);

  // Register the /herd toggle (returns widget state for lifecycle management)
  widgetState = registerHerd(pi, projectRoot, configDirName);

  pi.on("session_start", (_event, ctx) => {
    const id = getCurrentPaneInfo();
    if (!id) return; // not inside herdr: nothing to herd

    const config = loadConfig(ctx.cwd, CONFIG_DIR_NAME);
    const isMain = process.env.HERDR_HERD_MAIN_PANE === id.paneId;

    // name: /herd-new sets HERD_MY_PI_NAME on the child; otherwise fall back to paneId.
    const self: PaneRow = {
      paneId: id.paneId,
      name: process.env.HERD_MY_PI_NAME ?? id.paneId,
      type: "pane",
      workspaceId: id.workspaceId,
      model: readModelId(ctx),
      workingTree: null,
      lastActivityMs: Date.now(),
      startedMs: Date.now(),
      isMain,
    };

    writeSelfRow(ctx.cwd, self, CONFIG_DIR_NAME);

    heartbeat = startHeartbeat({
      projectRoot: ctx.cwd,
      configDirName: CONFIG_DIR_NAME,
      intervalMs: config.intervals.heartbeatMs,
      self,
    });

    // Auto-show widget if HERDR_HERD_WIDGET=1 (passed by /herd-new)
    if (widgetState) {
      maybeAutoShowWidget(pi, ctx, widgetState, ctx.cwd, CONFIG_DIR_NAME);
    }
  });

  pi.on("session_shutdown", (_event, ctx) => {
    heartbeat?.stop();
    heartbeat = null;

    if (widgetState) {
      stopWidgetOnShutdown(widgetState);
    }

    const id = getCurrentPaneInfo();
    if (id) removeSelfRow(ctx.cwd, id.paneId, CONFIG_DIR_NAME);
  });
}

/** Best-effort model id from ctx.model (shape varies; tolerant). */
function readModelId(ctx: unknown): string | undefined {
  const m = (ctx as { model?: { id?: string } }).model;
  return m?.id;
}
