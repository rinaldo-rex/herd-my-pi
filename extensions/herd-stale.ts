// /herd-stale — toggle stale-first sort order (Phase 2).
//
// Flips config.widget.staleFirst on the running widget. No restart needed —
// the next refresh picks up the change. This is the easiest way to test
// stale-first ordering from the keyboard.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { WidgetState } from "./herd";

export function registerHerdStale(
  pi: ExtensionAPI,
  widgetState: WidgetState,
): void {
  pi.registerCommand("herd-stale", {
    description: "Toggle stale-first sort order (neglected agents at top)",
    handler: async (_args, ctx) => {
      if (!widgetState.config) {
        ctx.ui.notify("Herd widget not active", "warning");
        return;
      }
      widgetState.config.widget.staleFirst = !widgetState.config.widget.staleFirst;
      const msg = widgetState.config.widget.staleFirst
        ? "Stale-first: neglected agents at top"
        : "Recent-first: most active at top";
      ctx.ui.notify(msg, "info");
    },
  });
}
