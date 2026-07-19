// herdr CLI wrapper — availability, identity, surface creation, inspection,
// and transport primitives. Wraps `herdr 0.7.4` (confirmed surface).
//
// All `herdr` calls are synchronous subprocess calls over the local socket —
// ms-scale, safe to call from a timer or command handler.

import { execFileSync } from "node:child_process";
import type {
  AgentStatus,
  HerdrPane,
  Identity,
  PaneInspection,
} from "./types";

export interface HerdrRunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

function run(args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): string {
  return execFileSync("herdr", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });
}

function tryRun(args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): HerdrRunResult {
  try {
    const stdout = run(args, opts);
    return { ok: true, stdout, stderr: "", code: 0 };
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException & { status?: number; stdout?: string; stderr?: string };
    return {
      ok: false,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? String(err?.message ?? err),
      code: err.status ?? null,
    };
  }
}

// --- availability & identity ---

export function isHerdrAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.HERDR_ENV === "1";
}

export function herdrOnPath(): boolean {
  return tryRun(["--version"]).ok;
}

export function readCurrentPaneId(): string | null {
  const r = tryRun(["pane", "current"]);
  if (!r.ok) return null;
  return parsePaneId(r.stdout);
}

export function getCurrentPaneInfo(env: NodeJS.ProcessEnv = process.env): Identity | null {
  const paneId = env.HERDR_PANE_ID;
  const tabId = env.HERDR_TAB_ID;
  const workspaceId = env.HERDR_WORKSPACE_ID;
  if (paneId && tabId && workspaceId) return { paneId, tabId, workspaceId };
  // Fallback for older herdr builds lacking the identity env.
  const cur = paneId ?? readCurrentPaneId();
  if (cur) return { paneId: cur, tabId: tabId ?? "", workspaceId: workspaceId ?? "" };
  return null;
}

// --- parsing (pure; unit-tested with captured fixtures) ---

interface HerdrEnvelope {
  id?: string;
  result?: unknown;
  type?: string;
  error?: string;
}

function safeJson<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

/**
 * Parse a pane id from `herdr pane current` output.
 * Handles: plain text `w13:p1`, `{"result":"w13:p1"}`,
 * `{"result":{"pane_id":"w13:p1"}}`, and `{"result":{"pane":{...}}}`.
 */
export function parsePaneId(stdout: string): string | null {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  const env = safeJson<HerdrEnvelope>(trimmed);
  if (!env) return trimmed.split(/\s+/)[0] || null; // plain text fallback
  const r = env.result;
  if (typeof r === "string") return r || null;
  if (r && typeof r === "object") {
    const obj = r as Record<string, unknown>;
    if (typeof obj.pane_id === "string") return obj.pane_id;
    const pane = obj.pane as Record<string, unknown> | undefined;
    if (pane && typeof pane.pane_id === "string") return pane.pane_id;
  }
  return null;
}

/** Parse a single pane from `herdr pane get` / `pane current` (`result.pane`). */
export function parsePane(stdout: string): HerdrPane | null {
  const env = safeJson<HerdrEnvelope>(stdout);
  const r = env?.result;
  if (r && typeof r === "object") {
    const obj = r as Record<string, unknown>;
    const pane = obj.pane;
    if (pane && typeof pane === "object" && "pane_id" in (pane as object)) {
      return pane as HerdrPane;
    }
    if ("pane_id" in obj) return obj as unknown as HerdrPane; // tolerant
  }
  return null;
}

/** Parse a pane list from `herdr pane list` (`result.panes`). */
export function parsePaneList(stdout: string): HerdrPane[] {
  const env = safeJson<HerdrEnvelope>(stdout);
  const r = env?.result;
  if (r && typeof r === "object") {
    const obj = r as Record<string, unknown>;
    if (Array.isArray(obj.panes)) return obj.panes as HerdrPane[];
    if (Array.isArray(r)) return r as HerdrPane[]; // tolerant
  }
  return [];
}

// --- inspection ---

export function inspectPane(paneId: string): PaneInspection {
  const r = tryRun(["pane", "get", paneId]);
  if (!r.ok) {
    const missing = /not found|no such|unknown/i.test(r.stderr);
    return { kind: missing ? "missing" : "unavailable" };
  }
  const pane = parsePane(r.stdout);
  if (!pane) return { kind: "unavailable" };
  return {
    kind: "present",
    agent: pane.agent,
    agentStatus: pane.agent_status as AgentStatus | undefined,
    cwd: pane.cwd,
    sessionPath: pane.agent_session?.value,
  };
}

export function listPanes(workspaceId: string): HerdrPane[] {
  const r = tryRun(["pane", "list", "--workspace", workspaceId]);
  if (!r.ok) return [];
  return parsePaneList(r.stdout);
}

// --- surface creation (pure arg-builders + side-effecting runners) ---

function envPairs(env?: Record<string, string>): string[] {
  if (!env) return [];
  return Object.entries(env).flatMap(([k, v]) => ["--env", `${k}=${v}`]);
}

export interface CreateTabOpts {
  workspaceId: string;
  cwd: string;
  name: string;
  env?: Record<string, string>;
  focus?: boolean;
}

export function buildTabCreateArgs(o: CreateTabOpts): string[] {
  const args = [
    "tab", "create",
    "--workspace", o.workspaceId,
    "--cwd", o.cwd,
    "--label", o.name,
  ];
  args.push(...envPairs(o.env));
  args.push(o.focus ? "--focus" : "--no-focus");
  return args;
}

export interface CreateSplitOpts {
  parent: string;
  direction: "right" | "down";
  cwd: string;
  name?: string; // split has no --label; we rename after
  env?: Record<string, string>;
  focus?: boolean;
}

export function buildSplitArgs(o: CreateSplitOpts): string[] {
  const args = [
    "pane", "split", o.parent,
    "--direction", o.direction,
    "--cwd", o.cwd,
  ];
  args.push(...envPairs(o.env));
  args.push(o.focus ? "--focus" : "--no-focus");
  return args;
}

/** Tolerant extraction of a created pane id from tab create / pane split output. */
function extractCreatedPaneId(stdout: string): string | null {
  const env = safeJson<HerdrEnvelope>(stdout.trim());
  if (!env) return null;
  const r = env.result;
  if (typeof r === "string") return r || null;
  if (r && typeof r === "object") {
    const obj = r as Record<string, unknown>;
    if (typeof obj.pane_id === "string") return obj.pane_id;
    const pane = obj.pane as Record<string, unknown> | undefined;
    if (pane && typeof pane.pane_id === "string") return pane.pane_id;
    if (typeof obj.id === "string") return obj.id;
  }
  return null;
}

export function createTab(o: CreateTabOpts): string | null {
  const r = tryRun(buildTabCreateArgs(o));
  if (!r.ok) return null;
  return parsePaneId(r.stdout) ?? extractCreatedPaneId(r.stdout);
}

export function createSplit(o: CreateSplitOpts): string | null {
  const r = tryRun(buildSplitArgs(o));
  if (!r.ok) return null;
  const paneId = parsePaneId(r.stdout) ?? extractCreatedPaneId(r.stdout);
  if (paneId && o.name) renamePane(paneId, o.name); // best-effort
  return paneId;
}

export function renamePane(paneId: string, label: string): boolean {
  return tryRun(["pane", "rename", paneId, label]).ok;
}

export function renameTab(tabId: string, label: string): boolean {
  return tryRun(["tab", "rename", tabId, label]).ok;
}

export function renameWorkspace(workspaceId: string, label: string): boolean {
  // `herdr workspace rename` subcommand — best-effort (confirm exact name in Phase 1).
  return tryRun(["workspace", "rename", workspaceId, label]).ok;
}

// --- transport primitives ---

/** `herdr pane run <paneId> <command>` — types text + Enter in one request. */
export function sendCommand(paneId: string, text: string): boolean {
  return tryRun(["pane", "run", paneId, text]).ok;
}

/** `herdr pane send-keys <paneId> Escape` — for `/herd-push --force` interrupt. */
export function sendEscape(paneId: string): boolean {
  return tryRun(["pane", "send-keys", paneId, "Escape"]).ok;
}

export function closePane(paneId: string): boolean {
  return tryRun(["pane", "close", paneId]).ok;
}

/** Focus a tab by id — used by the interactive widget to switch to a pane's tab. */
export function focusTab(tabId: string): boolean {
  return tryRun(["tab", "focus", tabId]).ok;
}

/** List tabs in a workspace — used to resolve user-chosen tab labels per pane. */
export function listTabs(workspaceId: string): Array<{ tab_id: string; label: string }> {
  const r = tryRun(["tab", "list", "--workspace", workspaceId]);
  if (!r.ok) return [];
  const env = safeJson<{ result?: { tabs?: Array<{ tab_id: string; label: string }> } }>(r.stdout);
  const tabs = env?.result?.tabs;
  if (Array.isArray(tabs)) return tabs.map((t) => ({ tab_id: t.tab_id, label: t.label }));
  return [];
}

/** Resolve a workspace_id → user-set label. */
export function getWorkspaceLabel(workspaceId: string): string | null {
  const r = tryRun(["workspace", "list"]);
  if (!r.ok) return null;
  const env = safeJson<{ result?: { workspaces?: Array<{ workspace_id: string; label: string }> } }>(r.stdout);
  const workspaces = env?.result?.workspaces;
  if (Array.isArray(workspaces)) {
    const ws = workspaces.find((w) => w.workspace_id === workspaceId);
    if (ws?.label) return ws.label;
  }
  return null;
}
