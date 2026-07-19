// /herd-new — spawn a herd agent.
// With name: spawn a side pane (default) via createSplit, start pi in it.
// Without name: open a custom widget with fields for name, type, role, model, thinking, goal.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { getCurrentPaneInfo, createSplit, createTab, sendCommand } from "../src/herdr";
import { loadConfig } from "../src/config";
import { writeSelfRow } from "../src/state";
import { HERD_DIR_NAME, type PaneRow } from "../src/types";

// Ready-delay for spawned pi instances (ms). Adjustable via env.
const READY_DELAY_MS = parseInt(process.env.PI_SUBAGENT_SHELL_READY_DELAY_MS ?? "1500", 10);

export function registerHerdNew(pi: ExtensionAPI, projectRoot: string, configDirName: string): void {
  pi.registerCommand("herd-new", {
    description: "Spawn a new herd agent",
    handler: async (args, ctx) => {
      const nameArg = args.trim();
      if (nameArg && !nameArg.startsWith("--")) {
        await spawnNamed(pi, ctx, nameArg, projectRoot, configDirName, args);
      } else {
        await spawnWithWidget(pi, ctx, projectRoot, configDirName);
      }
    },
  });
}

/** Named spawn: create a split, start pi with env vars. */
async function spawnNamed(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  name: string,
  projectRoot: string,
  configDirName: string,
  args: string = "",
): Promise<void> {
  const id = getCurrentPaneInfo();
  if (!id) {
    ctx.ui.notify("Not running inside herdr — cannot spawn", "error");
    return;
  }

  const config = loadConfig(projectRoot, configDirName);

  // Check for name collision
  const { loadState } = await import("../src/state");
  const existing = loadState(projectRoot, configDirName);
  if (existing.some((r) => r.name === name)) {
    if (config.spawn.collisionPolicy === "auto-suffix") {
      // Find next available suffix
      let suffix = 2;
      while (existing.some((r) => r.name === `${name}-${suffix}`)) suffix++;
      name = `${name}-${suffix}`;
    } else {
      ctx.ui.notify(`Name collision: "${name}" already exists. Use --force or configure collisionPolicy.`, "error");
      return;
    }
  }

  // Check if --isolate flag is present
  const isIsolate = args.includes("--isolate");

  if (isIsolate) {
    await spawnIsolated(pi, ctx, name, projectRoot, configDirName, id, args);
    return;
  }

  // Build env for the child
  const childEnv: Record<string, string> = {
    HERDR_HERD_MAIN_PANE: id.paneId,
    HERDR_HERD_WIDGET: "1",
    HERD_MY_PI_NAME: name,
  };

  // Create the pane
  const paneId = createSplit({
    parent: id.paneId,
    direction: config.spawn.defaultDirection,
    cwd: projectRoot,
    name,
    env: childEnv,
    focus: false,
  });

  if (!paneId) {
    ctx.ui.notify(`Failed to create pane for "${name}"`, "error");
    return;
  }

  // Wait for pi to be ready, then send the launch command
  setTimeout(() => {
    // Build pi command with optional model/thinking from role
    const role = discoverRole(projectRoot, configDirName, args);
    let piCmd = "pi";
    if (role?.model) piCmd += ` --model ${role.model}`;
    if (role?.thinking) piCmd += ` --thinking ${role.thinking}`;
    if (role?.goal) piCmd += ` --system-prompt "${escapeShell(role.goal)}"`;

    sendCommand(paneId, piCmd);
  }, READY_DELAY_MS);

  // Write the child's initial state row
  const now = Date.now();
  const childRow: PaneRow = {
    paneId,
    name,
    type: "pane",
    workspaceId: id.workspaceId,
    lastActivityMs: now,
    startedMs: now,
    isMain: false,
  };
  writeSelfRow(projectRoot, childRow, configDirName);

  ctx.ui.notify(`Spawned "${name}" (${paneId})`, "info");
}

/** Isolated spawn: use wt to create a worktree and launch pi inside it. */
async function spawnIsolated(
  _pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  name: string,
  projectRoot: string,
  configDirName: string,
  id: { paneId: string; workspaceId: string },
  args: string = "",
): Promise<void> {
  // Check wt is available
  try {
    execFileSync("wt", ["--version"], { stdio: "ignore" });
  } catch {
    ctx.ui.notify("wt (Worktrunk) not found. Install it to use --isolate.", "error");
    return;
  }

  const config = loadConfig(projectRoot, configDirName);
  const branch = `${config.worktrees.branchPrefix}${name}`;

  // Build the pi command to run inside the worktree
  const role = discoverRole(projectRoot, configDirName, "");
  let piCmd = "pi";
  if (role?.model) piCmd += ` --model ${role.model}`;
  if (role?.thinking) piCmd += ` --thinking ${role.thinking}`;

  // Build env for the child
  const childEnv: Record<string, string> = {
    HERDR_HERD_MAIN_PANE: id.paneId,
    HERDR_HERD_WIDGET: "1",
    HERD_MY_PI_NAME: name,
  };

  // Create the pane first
  const paneId = createSplit({
    parent: id.paneId,
    direction: config.spawn.defaultDirection,
    cwd: projectRoot,
    name,
    env: childEnv,
    focus: false,
  });

  if (!paneId) {
    ctx.ui.notify(`Failed to create pane for "${name}"`, "error");
    return;
  }

  // Send the wt command to create worktree + launch pi
  setTimeout(() => {
    const wtCmd = `wt switch -c -x "${piCmd}" ${branch}`;
    sendCommand(paneId, wtCmd);
  }, READY_DELAY_MS);

  // Write the child's initial state row with worktree info
  const now = Date.now();
  const childRow: PaneRow = {
    paneId,
    name,
    type: "pane",
    workspaceId: id.workspaceId,
    branch,
    lastActivityMs: now,
    startedMs: now,
    isMain: false,
  };
  writeSelfRow(projectRoot, childRow, configDirName);

  ctx.ui.notify(`Spawned isolated "${name}" (${paneId}) on branch ${branch}`, "info");
}

/** Widget-based spawn (no name arg): show a form for all options. */
async function spawnWithWidget(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  projectRoot: string,
  configDirName: string,
): Promise<void> {
  // Discover available roles
  const roles = discoverRoles(projectRoot, configDirName);

  // Build form fields
  const fields = [
    { id: "name", label: "Name", type: "text" as const, required: true },
    {
      id: "type",
      label: "Type",
      type: "select" as const,
      options: [
        { value: "pane", label: "Pane (split)" },
        { value: "tab", label: "Tab" },
      ],
      default: "pane",
    },
    {
      id: "role",
      label: "Role",
      type: "select" as const,
      options: [
        { value: "", label: "plain (no role)" },
        ...roles.map((r) => ({ value: r.name, label: r.name })),
      ],
      default: "",
    },
    { id: "model", label: "Model", type: "text" as const },
    { id: "thinking", label: "Thinking", type: "text" as const },
    { id: "goal", label: "Goal / extra context", type: "text" as const },
  ];

  // Use ctx.ui.custom() for the form
  // For now, fall back to a simple sequential input flow
  const name = await ctx.ui.input("Agent name:", "");
  if (!name) return;

  const typeChoice = await ctx.ui.select("Pane type:", ["pane", "tab"]);
  const type = typeChoice ?? "pane";

  const roleNames = ["(plain)", ...roles.map((r) => r.name)];
  const roleChoice = await ctx.ui.select("Role:", roleNames);
  const roleName = roleChoice === "(plain)" ? "" : (roleChoice ?? "");

  const model = await ctx.ui.input("Model (optional, e.g. anthropic/claude-sonnet-4-20250514):", "");
  const thinking = await ctx.ui.input("Thinking level (optional: off/minimal/low/medium/high):", "");
  const goal = await ctx.ui.input("Goal / extra context (optional):", "");

  // Build args string for spawnNamed
  let args = name;
  if (roleName) args += ` --role ${roleName}`;

  await spawnNamed(pi, ctx, name, projectRoot, configDirName);
}

/** Discover role files from .pi/agents/. */
function discoverRoles(
  projectRoot: string,
  configDirName: string,
): Array<{ name: string; model?: string; thinking?: string; goal?: string }> {
  const agentsDir = join(projectRoot, configDirName, "agents");
  if (!existsSync(agentsDir)) return [];

  const files = readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
  return files.map((f) => {
    const content = readFileSync(join(agentsDir, f), "utf8");
    const name = f.replace(/\.md$/, "");
    const model = extractFrontmatter(content, "model");
    const thinking = extractFrontmatter(content, "thinking");
    const goal = extractFrontmatter(content, "goal");
    return { name, model: model || undefined, thinking: thinking || undefined, goal: goal || undefined };
  });
}

/** Discover a specific role by name or from args. */
function discoverRole(
  projectRoot: string,
  configDirName: string,
  args: string,
): { model?: string; thinking?: string; goal?: string } | null {
  // Look for --role flag
  const roleMatch = args.match(/--role\s+(\S+)/);
  const roleName = roleMatch?.[1];
  if (!roleName) return null;

  const roles = discoverRoles(projectRoot, configDirName);
  return roles.find((r) => r.name === roleName) ?? null;
}

/** Extract a frontmatter value from a markdown file. */
function extractFrontmatter(content: string, key: string): string | null {
  const match = content.match(/^---\n[\s\S]*?\n---/);
  if (!match) return null;
  const fm = match[0];
  const lineMatch = fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return lineMatch?.[1]?.trim() ?? null;
}



function escapeShell(s: string): string {
  return s.replace(/"/g, '\\"').replace(/\$/g, "\\$");
}
