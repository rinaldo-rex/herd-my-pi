// /herd-push — ferry my last message to a target.
// /herd-receive — inbound: decode + inject as next prompt.
// Phase 2.1: --compact <template> injects a compact-for-* template, then you push.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { getCurrentPaneInfo, sendCommand, sendEscape } from "../src/herdr";
import { loadConfig } from "../src/config";
import { loadState } from "../src/state";
import { HERD_DIR_NAME } from "../src/types";

export function registerHerdPush(pi: ExtensionAPI, projectRoot: string, configDirName: string): void {
  // /herd-push <name> [--force] [--compact <template> [<focus>]]
  pi.registerCommand("herd-push", {
    description: "Ferry your last message to a target agent. Use --compact <template> to run a compact prompt first.",
    handler: async (args, ctx) => {
      const parsed = parsePushArgs(args);
      if (parsed.compact) {
        await handleCompact(pi, ctx, parsed, projectRoot, configDirName);
        return;
      }
      if (!parsed.name) {
        ctx.ui.notify("Usage: /herd-push <name> [--force] [--compact <template> [<focus>]]", "warning");
        return;
      }
      await handlePush(pi, ctx, parsed.name, parsed.force, projectRoot, configDirName);
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

interface ParsedPushArgs {
  name: string;
  force: boolean;
  compact: boolean;
  compactTemplate: string;
  compactFocus: string;
}

function parsePushArgs(args: string): ParsedPushArgs {
  const parts = args.trim().split(/\s+/);
  let name = "";
  let force = false;
  let compact = false;
  let compactTemplate = "";
  let compactFocus = "";

  let i = 0;
  while (i < parts.length) {
    const p = parts[i]!;
    if (p === "--force") {
      force = true;
    } else if (p === "--compact") {
      compact = true;
      i++;
      if (i < parts.length) {
        compactTemplate = parts[i]!;
        i++;
        // Rest is the focus arg ($1)
        compactFocus = parts.slice(i).join(" ");
        break;
      }
    } else if (!name && !p.startsWith("--")) {
      name = p;
    }
    i++;
  }
  return { name, force, compact, compactTemplate, compactFocus };
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

  const state = loadState(projectRoot, configDirName);
  const target = state.find((r) => r.name === targetName);
  if (!target) {
    ctx.ui.notify(`Agent "${targetName}" not found in roster`, "error");
    return;
  }

  const lastMsg = getLastAssistantMessage(ctx);
  if (!lastMsg) {
    ctx.ui.notify("No assistant message to push", "warning");
    return;
  }

  const edited = await ctx.ui.editor(`Push to ${targetName}:`, lastMsg);
  if (!edited) return;

  if (force) {
    sendEscape(target.paneId);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

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

// ---------------------------------------------------------------------------
// Phase 2.1: --compact <template> [<focus>]
// ---------------------------------------------------------------------------

/** Discover prompt templates from .pi/prompts/ and the package bundle. */
function discoverPrompts(projectRoot: string, configDirName: string): Array<{ name: string; description: string; file: string }> {
  const prompts: Array<{ name: string; description: string; file: string }> = [];
  const localDir = join(projectRoot, configDirName, "prompts");
  // Package prompts live one level up from extensions/
  const packageDir = join(import.meta.dirname ?? __dirname, "..", "prompts");

  for (const dir of [localDir, packageDir]) {
    if (!existsSync(dir)) continue;
    try {
      for (const f of readdirSync(dir)) {
        if (!f.endsWith(".md")) continue;
        const name = f.replace(/\.md$/, "");
        if (prompts.some((p) => p.name === name)) continue;
        const content = readFileSync(join(dir, f), "utf8");
        const descMatch = content.match(/^description:\s*"(.+)"\s*$/m);
        const desc = descMatch?.[1] ?? name;
        prompts.push({ name, description: desc, file: f });
      }
    } catch { /* skip unreadable dirs */ }
  }
  return prompts;
}

async function handleCompact(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  parsed: ParsedPushArgs,
  projectRoot: string,
  configDirName: string,
): Promise<void> {
  const prompts = discoverPrompts(projectRoot, configDirName);

  let tmplName = parsed.compactTemplate;
  if (!tmplName) {
    if (prompts.length === 0) {
      ctx.ui.notify("No prompt templates found. Run /herd-init to scaffold them.", "warning");
      return;
    }
    const names = prompts.filter((p) => p.name.startsWith("compact-for-")).map((p) => p.name);
    if (names.length === 0) {
      ctx.ui.notify("No compact-for-* templates found.", "warning");
      return;
    }
    const choice = await ctx.ui.select("Choose a compact template:", names);
    if (!choice) return;
    tmplName = choice;
  }

  const match = prompts.find((p) => p.name === tmplName);
  if (!match) {
    const names = prompts.map((p) => p.name).join(", ");
    ctx.ui.notify(`Template "${tmplName}" not found. Available: ${names}`, "error");
    return;
  }

  // Read the template body (strip frontmatter)
  let body: string;
  try {
    const srcDir = join(projectRoot, configDirName, "prompts");
    const pkgDir = join(import.meta.dirname ?? __dirname, "..", "prompts");
    const src = existsSync(join(srcDir, match.file)) ? srcDir : pkgDir;
    body = readFileSync(join(src, match.file), "utf8");
  } catch {
    ctx.ui.notify(`Could not read template "${tmplName}"`, "error");
    return;
  }

  body = body.replace(/^---[\s\S]*?\n---\n?/, "");

  // Substitute $1
  let focus = parsed.compactFocus;
  if (!focus) {
    focus = await ctx.ui.input(`Focus for ${tmplName}:`, "") ?? "";
    if (!focus) return;
  }
  body = body.replace(/\$1/g, focus);

  // Inject as the next prompt
  if (ctx.isIdle()) {
    pi.sendUserMessage(body);
  } else {
    pi.sendUserMessage(body, { deliverAs: "steer" });
  }

  const targetHint = parsed.name ? ` Then run /herd-push ${parsed.name}` : " Then run /herd-push <name>";
  ctx.ui.notify(`Compacting with ${match.name}…${targetHint}.`, "info");
}

// ---------------------------------------------------------------------------
// /herd-receive
// ---------------------------------------------------------------------------

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
