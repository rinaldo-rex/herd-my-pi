// /herd-push — ferry my last message to a target.
// /herd-receive — inbound: decode + inject as next prompt.

import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { getCurrentPaneInfo, sendCommand, sendEscape } from "../src/herdr";
import { loadConfig } from "../src/config";
import { loadState } from "../src/state";
import { HERD_DIR_NAME } from "../src/types";

export function registerHerdPush(pi: ExtensionAPI, projectRoot: string, configDirName: string): void {
  // /herd-push <name> [--force]
  pi.registerCommand("herd-push", {
    description: "Ferry your last message to a target agent",
    handler: async (args, ctx) => {
      const { name, force } = parsePushArgs(args);
      if (!name) {
        ctx.ui.notify("Usage: /herd-push <name> [--force]", "warning");
        return;
      }
      await handlePush(pi, ctx, name, force, projectRoot, configDirName);
    },
  });

  // /herd-receive <base64> (internal — inbound message)
  pi.registerCommand("herd-receive", {
    description: "Receive a ferried message (internal)",
    handler: async (args, ctx) => {
      handleReceive(pi, ctx, args.trim());
    },
  });
}

function parsePushArgs(args: string): { name: string; force: boolean } {
  const parts = args.trim().split(/\s+/);
  let name = "";
  let force = false;
  for (const p of parts) {
    if (p === "--force") {
      force = true;
    } else if (!name) {
      name = p;
    }
  }
  return { name, force };
}

async function handlePush(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  targetName: string,
  force: boolean,
  projectRoot: string,
  configDirName: string,
): Promise<void> {
  const id = getCurrentPaneInfo();
  if (!id) {
    ctx.ui.notify("Not running inside herdr", "error");
    return;
  }

  // Resolve target name → paneId from roster
  const state = loadState(projectRoot, configDirName);
  const target = state.find((r) => r.name === targetName);
  if (!target) {
    ctx.ui.notify(`Agent "${targetName}" not found in roster`, "error");
    return;
  }

  // Read my own last assistant message
  const lastMsg = getLastAssistantMessage(ctx);
  if (!lastMsg) {
    ctx.ui.notify("No assistant message to push", "warning");
    return;
  }

  // Open editor widget pre-filled with the message
  const edited = await ctx.ui.editor(`Push to ${targetName}:`, lastMsg);
  if (!edited) return; // User cancelled

  // If target is mid-turn and --force, send escape first
  if (force) {
    sendEscape(target.paneId);
    // Small delay to let the escape take effect
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Encode and send
  const payload = Buffer.from(
    JSON.stringify({ message: edited, from: id.paneId }),
  ).toString("base64");

  const ok = sendCommand(target.paneId, `/herd-receive ${payload}`);
  if (ok) {
    ctx.ui.notify(`Pushed to ${targetName}`, "info");
  } else {
    ctx.ui.notify(`Failed to push to ${targetName}`, "error");
  }
}

function handleReceive(pi: ExtensionAPI, ctx: ExtensionCommandContext, base64: string): void {
  if (!base64) {
    ctx.ui.notify("herd-receive: empty payload", "warning");
    return;
  }

  try {
    const json = Buffer.from(base64, "base64").toString("utf8");
    const { message, from } = JSON.parse(json) as { message: string; from: string };

    if (!message) {
      ctx.ui.notify("herd-receive: empty message", "warning");
      return;
    }

    // Inject as the next prompt via pi.sendUserMessage
    // Use deliverAs: "followUp" if we're streaming, or send directly if idle
    if (ctx.isIdle()) {
      pi.sendUserMessage(message);
    } else {
      pi.sendUserMessage(message, { deliverAs: "steer" });
    }
  } catch (e) {
    ctx.ui.notify(`herd-receive: decode error: ${e}`, "error");
  }
}

/** Read the last assistant message from the session. */
function getLastAssistantMessage(ctx: ExtensionCommandContext): string | null {
  const entries = ctx.sessionManager.getEntries();
  // Walk backwards to find the last assistant message
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.type === "message" && entry.message.role === "assistant") {
      // Extract text content
      const content = entry.message.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        const textParts = content
          .filter((c: any) => c.type === "text")
          .map((c: any) => c.text);
        if (textParts.length > 0) return textParts.join("\n");
      }
      return null;
    }
  }
  return null;
}
