import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

// hc and herdr-app report failures as `{error: {message}}` or `{error: "..."}`.
function errorMessage(text: string): string | undefined {
	try {
		const { error } = JSON.parse(text.split("\n").pop() ?? "");
		return typeof error === "string" ? error : error?.message;
	} catch {
		return undefined;
	}
}

async function json<T>(cmd: string, args: string[]): Promise<T> {
	try {
		const { stdout } = await run(cmd, args, { maxBuffer: 16 * 1024 * 1024 });
		return JSON.parse(stdout) as T;
	} catch (e) {
		const err = e as { stdout?: string; stderr?: string; message: string };
		const text = `${err.stderr ?? ""}${err.stdout ?? ""}`.trim();
		throw new Error(`${cmd} ${args[0]}: ${errorMessage(text) ?? (text || err.message)}`);
	}
}

export interface Terminal {
	address: string;
	name?: string | null;
	parent?: string | null;
	state: "live" | "finished";
	/** What the program reports: working, idle, done, blocked, error. */
	status?: { state?: string } | null;
	labels?: Record<string, string>;
}

export const getTerminal = (t: string) => json<Terminal>("hc", ["get", t, "--json"]);

export const liveTerminals = async () =>
	(await json<{ terminals: Terminal[] }>("hc", ["ls", "--json"])).terminals;

export async function setLabels(t: string, labels: Record<string, string>): Promise<void> {
	await json("hc", ["label", t, "--json", ...Object.entries(labels).map(([k, v]) => `${k}=${v}`)]);
}

export interface RunOptions {
	name: string;
	cwd: string;
	labels: Record<string, string>;
	outliveParent: boolean;
	argv: string[];
}

export async function runBackground(o: RunOptions): Promise<Terminal> {
	const args = ["run", "--bg", "--json", "--name", o.name, "--cwd", o.cwd];
	for (const [k, v] of Object.entries(o.labels)) args.push("--label", `${k}=${v}`);
	if (o.outliveParent) args.push("--outlive-parent");
	return json<Terminal>("hc", [...args, "--", ...o.argv]);
}

interface AppLs {
	spaces: { tabs: { id: string; name: string; terminals: { terminal: string }[] }[] }[];
}

/** The Herdr tab showing a terminal, if the window has adopted it yet. */
export async function tabOf(address: string): Promise<string | undefined> {
	const ls = await json<AppLs>("herdr-app", ["ls"]);
	for (const space of ls.spaces)
		for (const tab of space.tabs) if (tab.terminals.some((t) => t.terminal === address)) return tab.id;
}

export async function renameTab(id: string, name: string): Promise<void> {
	await json("herdr-app", ["do", "tab.rename", "--id", id, "--name", name]);
}
