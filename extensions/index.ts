// herd-my-pi — Phase 0 entry point.
//
// Thin lifecycle wiring only. NO commands, NO widget (those land in Phase 1).
// On session_start: write this instance's own state row + start the heartbeat.
// On session_shutdown: stop the heartbeat + drop our row (it'll show as
// `live:false` once herdr pane list stops reporting us, then age out).
//
// Runs inside pi via jiti (TS, no build). `@earendil-works/pi-coding-agent` is
// provided by the host — listed as a peerDependency. (Phase 1 will install it
// locally for accurate tsc types of ExtensionAPI/ctx; for Phase 0 the live
// `pi -e ./extensions` smoke test is the type/runtime gate.)

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { getCurrentPaneInfo } from "../src/herdr";
import { loadConfig } from "../src/config";
import { removeSelfRow, writeSelfRow } from "../src/state";
import { startHeartbeat, type Heartbeat } from "../src/heartbeat";
import type { PaneRow } from "../src/types";

export default function (pi: ExtensionAPI): void {
  let heartbeat: Heartbeat | null = null;

  pi.on("session_start", (_event, ctx) => {
    const id = getCurrentPaneInfo();
    if (!id) return; // not inside herdr: nothing to herd

    const config = loadConfig(ctx.cwd, CONFIG_DIR_NAME);
    const isMain = process.env.HERDR_HERD_MAIN_PANE === id.paneId;

    // name: Phase 1's /herd-new sets HERDR_HERD_NAME on the child; otherwise
    // fall back to the paneId.
    const self: PaneRow = {
      paneId: id.paneId,
      name: process.env.HERDR_HERD_NAME ?? id.paneId,
      type: "pane",
      workspaceId: id.workspaceId,
      // model/thinking: best-effort from ctx.model (Phase 1 will read precisely).
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
  });

  pi.on("session_shutdown", (_event, ctx) => {
    heartbeat?.stop();
    heartbeat = null;
    const id = getCurrentPaneInfo();
    if (id) removeSelfRow(ctx.cwd, id.paneId, CONFIG_DIR_NAME);
  });
}

/** Best-effort model id from ctx.model (shape varies; tolerant). */
function readModelId(ctx: unknown): string | undefined {
  const m = (ctx as { model?: { id?: string } }).model;
  return m?.id;
}
