// /herd-pull — ferry a target's last message into my input.
// /herd-emit-last — inbound: read own last assistant msg and send back.

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { getCurrentPaneInfo, sendCommand } from "../src/herdr";
import { loadState } from "../src/state";
import { HERD_DIR_NAME } from "../src/types";

export function registerHerdPull(pi: ExtensionAPI, projectRoot: string, configDirName: string): void {
  // /herd-pull <name> [--edit]
  pi.registerCommand("herd-pull", {
    description: "Ferry a target's last message into your input",
    handler: async (args, ctx) => {
      const { name, edit } = parsePullArgs(args);
      if (!name) {
        ctx.ui.notify("Usage: /herd-pull <name> [--edit]", "warning");
        return;
      }
      await handlePull(pi, ctx, name, edit, projectRoot, configDirName);
    },
  });

  // /herd-emit-last --to <paneId> (internal — sends own last msg back)
  pi.registerCommand("herd-emit-last", {
    description: "Emit your last assistant message (internal)",
    handler: async (args, ctx) => {
      handleEmitLast(pi, ctx, args.trim());
    },
  });
}

function parsePullArgs(args: string): { name: string; edit: boolean } {
  const parts = args.trim().split(/\s+/);
  let name = "";
  let edit = false;
  for (const p of parts) {
    if (p === "--edit") {
      edit = true;
    } else if (!name) {
      name = p;
    }
  }
  return { name, edit };
}

async function handlePull(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  targetName: string,
  edit: boolean,
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

  // Two-hop round-trip:
  // 1. Send /herd-emit-last --to <myPaneId> to target
  // 2. Target's /herd-emit-last reads its last msg, base64 encodes, sends back via /herd-receive

  // We need to register a temporary handler for the response
  // Actually, /herd-receive is already registered, so the target will use it to send back.
  // But we need to know when the response arrives.
  // For simplicity, we'll send the command and the target will inject into our input directly.

  const ok = sendCommand(target.paneId, `/herd-emit-last --to ${id.paneId} --edit ${edit ? "true" : "false"}`);
  if (!ok) {
    ctx.ui.notify(`Failed to request from ${targetName}`, "error");
  }
}

function handleEmitLast(pi: ExtensionAPI, ctx: ExtensionCommandContext, args: string): void {
  // Parse --to <paneId> and --edit <bool>
  const toMatch = args.match(/--to\s+(\S+)/);
  const editMatch = args.match(/--edit\s+(\S+)/);
  const toPaneId = toMatch?.[1];
  const edit = editMatch?.[1] === "true";

  if (!toPaneId) {
    ctx.ui.notify("herd-emit-last: missing --to <paneId>", "warning");
    return;
  }

  // Read my own last assistant message
  const lastMsg = getLastAssistantMessage(ctx);
  if (!lastMsg) {
    ctx.ui.notify("herd-emit-last: no assistant message to emit", "warning");
    return;
  }

  // Encode and send back via /herd-receive
  const payload = Buffer.from(
    JSON.stringify({ message: lastMsg, from: getCurrentPaneInfo()?.paneId ?? "" }),
  ).toString("base64");

  // Send the message back. The receiving pane's /herd-receive will inject it.
  // But we need to tell it whether to inject directly or open editor.
  // We'll use a different command: /herd-receive-pull that handles the edit flag.
  const cmd = edit
    ? `/herd-receive-pull ${payload} --edit`
    : `/herd-receive ${payload}`;

  const ok = sendCommand(toPaneId, cmd);
  if (!ok) {
    ctx.ui.notify("herd-emit-last: failed to send back", "error");
  }
}

/** Register the /herd-receive-pull command (for pull responses with --edit support). */
export function registerHerdReceivePull(pi: ExtensionAPI): void {
  pi.registerCommand("herd-receive-pull", {
    description: "Receive a pulled message (internal)",
    handler: async (args, ctx) => {
      const parts = args.trim().split(/\s+/);
      const base64 = parts[0] ?? "";
      const edit = parts.includes("--edit");

      if (!base64) {
        ctx.ui.notify("herd-receive-pull: empty payload", "warning");
        return;
      }

      try {
        const json = Buffer.from(base64, "base64").toString("utf8");
        const { message } = JSON.parse(json) as { message: string; from: string };

        if (!message) {
          ctx.ui.notify("herd-receive-pull: empty message", "warning");
          return;
        }

        if (edit) {
          // Open editor widget pre-filled
          const edited = await ctx.ui.editor("Pulled message:", message);
          if (edited) {
            if (ctx.isIdle()) {
              pi.sendUserMessage(edited);
            } else {
              pi.sendUserMessage(edited, { deliverAs: "steer" });
            }
          }
        } else {
          // Direct inject into editor
          ctx.ui.setEditorText(message);
        }
      } catch (e) {
        ctx.ui.notify(`herd-receive-pull: decode error: ${e}`, "error");
      }
    },
  });
}

/** Read the last assistant message from the session. */
function getLastAssistantMessage(ctx: ExtensionCommandContext): string | null {
  const entries = ctx.sessionManager.getEntries();
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.type === "message" && entry.message.role === "assistant") {
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
