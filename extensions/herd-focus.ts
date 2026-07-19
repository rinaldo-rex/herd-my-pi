// /herd-focus — interactive selectable roster overlay (Phase 2).
//
// Opens a SelectList overlay built from the same roster data as the display-only
// widget.  ↑/↓ navigate, Enter focuses the target pane's tab, Esc dismisses.
// This turns the roster from a monitor into a pane switcher.
//
// D5 / D9 — human is orchestator; focus = convenience, not authority.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { Container, type SelectItem, SelectList, Text } from "@earendil-works/pi-tui";
import { loadConfig } from "../src/config";
import { readRoster } from "../src/state";
import { focusTab, getCurrentPaneInfo, readCurrentPaneId } from "../src/herdr";
import { sortRows, formatElapsed, elapsedTier, displayName } from "./widget";
import type { Config, RosterRow } from "../src/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a SelectItem label from a roster row (compact, single-line). */
function rowLabel(row: RosterRow, config: Config, now: number): string {
  const current = row.paneId === readCurrentPaneId() ? `${config.glyphs.current} ` : "  ";
  const main = row.isMain ? `${config.glyphs.main} ` : "  ";
  const name = displayName(row);

  const tree =
    row.workingTree === "dirty" ? " ⚡" :
    row.workingTree === "clean" ? " ✓" :
    "";

  const elapsedMs = row.lastActivityMs ? now - row.lastActivityMs : 0;
  const elapsed = row.lastActivityMs ? formatElapsed(elapsedMs) : "";
  const tier = row.lastActivityMs ? elapsedTier(elapsedMs, config) : "green";

  // Compact tier label for the SelectList (no ANSI — the theme callbacks colour it).
  const tierLabel =
    tier === "pulse" ? "!!" :
    tier === "red" ? "!!" :
    tier === "amber" ? " ~" :
    "  ";

  return `${current}${main}${name}${tree}  ${tierLabel} ${elapsed}`;
}

// ---------------------------------------------------------------------------
// Register /herd-focus
// ---------------------------------------------------------------------------

export function registerHerdFocus(
  pi: ExtensionAPI,
  projectRoot: string,
  configDirName: string,
): void {
  pi.registerCommand("herd-focus", {
    description: "Interactive roster — select a pane to focus",
    handler: async (_args, ctx) => {
      const id = getCurrentPaneInfo();
      if (!id) {
        ctx.ui.notify("herd-focus: not inside herdr", "warning");
        return;
      }

      const config = loadConfig(projectRoot, configDirName);
      await interactiveRoster(ctx, id.workspaceId, config, projectRoot, configDirName);
    },
  });
}

// ---------------------------------------------------------------------------
// Interactive overlay
// ---------------------------------------------------------------------------

async function interactiveRoster(
  ctx: ExtensionContext,
  workspaceId: string,
  config: Config,
  projectRoot: string,
  configDirName: string,
): Promise<void> {
  const now = Date.now();
  const roster = readRoster(workspaceId, projectRoot, configDirName);
  const liveRows = roster.filter((r) => r.live);
  const currentPaneId = readCurrentPaneId();
  const sorted = sortRows(liveRows, currentPaneId);

  const items: SelectItem[] = sorted.map((row) => ({
    value: row.paneId,
    label: rowLabel(row, config, now),
    description: row.tabId, // shown under the label for disambiguation
  }));

  if (items.length === 0) {
    ctx.ui.notify("Herd is empty", "info");
    return;
  }

  const result = await ctx.ui.custom<string | null>(
    (tui, theme, _keybindings, done) => {
      const container = new Container();

      // Top border
      container.addChild(
        new DynamicBorder((s: string) => theme.fg("accent", s)),
      );

      // Title
      container.addChild(
        new Text(theme.fg("accent", theme.bold("Focus Agent")), 1, 0),
      );

      // SelectList
      const selectList = new SelectList(items, Math.min(items.length, 12), {
        selectedPrefix: (t: string) => theme.fg("accent", t),
        selectedText: (t: string) => theme.fg("accent", t),
        description: (t: string) => theme.fg("muted", t),
        scrollInfo: (t: string) => theme.fg("dim", t),
        noMatch: (t: string) => theme.fg("warning", t),
      });

      selectList.onSelect = (item: SelectItem) => done(item.value);
      selectList.onCancel = () => done(null);

      container.addChild(selectList);

      // Help footer
      container.addChild(
        new Text(
          theme.fg("dim", "↑↓ navigate  ·  enter focus  ·  esc cancel"),
          1,
          0,
        ),
      );

      // Bottom border
      container.addChild(
        new DynamicBorder((s: string) => theme.fg("accent", s)),
      );

      return {
        render: (w: number) => container.render(w),
        invalidate: () => container.invalidate(),
        handleInput: (data: string) => {
          selectList.handleInput(data);
          tui.requestRender();
        },
      };
    },
    { overlay: true },
  );

  // Act on selection
  if (result) {
    const row = liveRows.find((r) => r.paneId === result);
    if (row?.tabId) {
      const ok = focusTab(row.tabId);
      if (!ok) {
        ctx.ui.notify(`Could not focus ${row.name ?? row.paneId}`, "error");
      }
    }
  }
}
