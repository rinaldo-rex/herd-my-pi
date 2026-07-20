// /herd-init — scaffold the local herd.
// Idempotent + merge (never overwrite user edits); --force resets.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { HERD_DIR_NAME } from "../src/types";
import { defaultConfig } from "../src/config";

// Resolve the package root (where prompts/ and agents/ live).
// When running via jiti from the extension dir, __dirname is extensions/.
const PACKAGE_ROOT = join(import.meta.dirname ?? __dirname, "..");

export function registerHerdInit(pi: ExtensionAPI): void {
  pi.registerCommand("herd-init", {
    description: "Scaffold the local herd (prompts, agents, config)",
    handler: async (args, ctx) => {
      const force = args.trim() === "--force";
      await scaffoldHerd(ctx, pi, force);
    },
  });
}

async function scaffoldHerd(
  ctx: ExtensionCommandContext,
  _pi: ExtensionAPI,
  force: boolean,
): Promise<void> {
  const projectRoot = ctx.cwd;
  const configDir = join(projectRoot, CONFIG_DIR_NAME);
  const herdDir = join(configDir, HERD_DIR_NAME);
  const promptsDir = join(configDir, "prompts");
  const agentsDir = join(configDir, "agents");

  // Ensure directories exist (Phase 2: templates dir for herd-save/--template)
  mkdirSync(herdDir, { recursive: true });
  mkdirSync(promptsDir, { recursive: true });
  mkdirSync(agentsDir, { recursive: true });
  mkdirSync(join(herdDir, "templates"), { recursive: true });

  let created = 0;
  let skipped = 0;

  // Scaffold config.json
  const configPath = join(herdDir, "config.json");
  if (force || !existsSync(configPath)) {
    const config = defaultConfig();
    writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
    created++;
  } else {
    skipped++;
  }

  // Scaffold prompts
  const promptFiles = [
    "compact-for-exploration.md",
    "compact-for-debug.md",
    "compact-for-prototype.md",
    "compact-for-review.md",
    "compact-for-handoff.md",
    "compact-for-variants.md",
  ];

  for (const file of promptFiles) {
    const dest = join(promptsDir, file);
    if (force || !existsSync(dest)) {
      const src = join(PACKAGE_ROOT, "prompts", file);
      if (existsSync(src)) {
        copyFile(src, dest);
        created++;
      }
    } else {
      skipped++;
    }
  }

  // Scaffold agents
  const agentFiles = [
    "explorer.md",
    "debugger.md",
    "prototyper.md",
    "reviewer.md",
  ];

  for (const file of agentFiles) {
    const dest = join(agentsDir, file);
    if (force || !existsSync(dest)) {
      const src = join(PACKAGE_ROOT, "agents", file);
      if (existsSync(src)) {
        copyFile(src, dest);
        created++;
      }
    } else {
      skipped++;
    }
  }

  // Report
  const parts: string[] = [];
  if (created > 0) parts.push(`${created} created`);
  if (skipped > 0) parts.push(`${skipped} skipped (already exist)`);
  const summary = parts.join(", ");
  ctx.ui.notify(`Herd scaffolded: ${summary}`, "info");
}

function copyFile(src: string, dest: string): void {
  const content = readFileSync(src, "utf8");
  writeFileSync(dest, content, "utf8");
}
