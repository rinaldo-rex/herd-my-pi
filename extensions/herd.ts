import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { type AgentTemplate, copyShippedAgents, loadAgents, PROJECT_AGENTS_DIR, SHIPPED_AGENTS_DIR } from "../src/agents.ts";
import { getTerminal, liveTerminals, renameTab, runBackground, type Terminal, tabOf } from "../src/hc.ts";
import { pickAgents } from "../src/picker.ts";

const ORCHESTRATOR_TAB = "Orchestrator";

// hc names: unique among live terminals, 1-32 of a-z 0-9 - _
function uniqueName(base: string, taken: Set<string>): string {
	const clean = base.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28) || "agent";
	let name = clean;
	for (let n = 2; taken.has(name); n++) name = `${clean}-${n}`;
	taken.add(name);
	return name;
}

function systemPrompt(agent: AgentTemplate, name: string, parent: string): string {
	return [
		`You are "${name}", a sub-agent in a herd. Your orchestrator is the pi at hc address ${parent};`,
		"your own address is in $HC_TERMINAL_ID. The person can hop into your terminal at any time,",
		"and their messages take priority. Load the herd-my-pi skill before talking to other agents.",
		"",
		agent.prompt,
	].join("\n");
}

/** Herdr adopts a labeled terminal into a new tab shortly after it starts. */
async function nameTabWhenAdopted(address: string, name: string): Promise<boolean> {
	for (let i = 0; i < 20; i++) {
		const tab = await tabOf(address);
		if (tab) {
			await renameTab(tab, name);
			return true;
		}
		await new Promise((r) => setTimeout(r, 250));
	}
	return false;
}

/** Project agents if the project has them; otherwise offer to copy the shipped ones in. */
async function chooseAgents(ctx: ExtensionCommandContext): Promise<{ agents: AgentTemplate[]; source: string }> {
	const projectDir = join(ctx.cwd, PROJECT_AGENTS_DIR);
	if (existsSync(projectDir)) return { agents: loadAgents(projectDir), source: PROJECT_AGENTS_DIR };

	const copy = await ctx.ui.confirm(
		"No herd agents in this project",
		`Copy the shipped agents to ${PROJECT_AGENTS_DIR}/ so you can edit and share them?\n` +
			"No: use the shipped agents as they are.",
	);
	if (!copy) return { agents: loadAgents(SHIPPED_AGENTS_DIR), source: "shipped agents" };
	const n = copyShippedAgents(projectDir);
	ctx.ui.notify(`Copied ${n} agent${n === 1 ? "" : "s"} to ${PROJECT_AGENTS_DIR}/`, "info");
	return { agents: loadAgents(projectDir), source: PROJECT_AGENTS_DIR };
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("herd", {
		description: "Start sub-agents from templates, each in its own Herdr tab (--outlive: keep them after this pi ends)",
		getArgumentCompletions: (prefix) =>
			"--outlive".startsWith(prefix) ? [{ value: "--outlive", label: "--outlive" }] : null,
		handler: async (args, ctx) => {
			const outlive = args.split(/\s+/).includes("--outlive");
			const self = process.env.HC_TERMINAL_ID;
			if (!self) return ctx.ui.notify("/herd needs to run inside a herdr-core (hc) terminal", "error");
			if (ctx.mode !== "tui") return ctx.ui.notify("/herd needs interactive mode", "error");

			let me: Terminal;
			try {
				me = await getTerminal(self);
			} catch (e) {
				return ctx.ui.notify(`Can't reach hc: ${(e as Error).message}`, "error");
			}
			// Without a Herdr space the agents still run, as hidden sub-agents of this terminal.
			const space = me.labels?.["herdr.space"];
			const myTab = me.labels?.["herdr.tab"];
			if (myTab) await renameTab(myTab, ORCHESTRATOR_TAB).catch(() => {});

			const { agents, source } = await chooseAgents(ctx);
			if (!agents.length) return ctx.ui.notify(`No agent templates (*.md) in ${source}`, "warning");

			const picked = await pickAgents(ctx, agents, source);
			if (!picked.length) return;

			const taken = new Set((await liveTerminals()).map((t) => t.name).filter((n): n is string => !!n));
			const started = await Promise.all(
				picked.map(async (agent) => {
					const name = uniqueName(agent.name, taken);
					const piArgs = ["--name", name, "--append-system-prompt", systemPrompt(agent, name, self)];
					if (agent.model) piArgs.push("--model", agent.model);
					if (agent.thinking) piArgs.push("--thinking", agent.thinking);
					try {
						const t = await runBackground({
							name,
							cwd: ctx.cwd,
							labels: { ...(space && { "herdr.space": space }), "herd.parent": self, "herd.role": agent.name },
							outliveParent: outlive,
							// hc terminals get the login environment, which may lack pi's node on PATH.
							argv: ["env", `PATH=${process.env.PATH ?? ""}`, "pi", ...piArgs],
						});
						const tabbed = space ? await nameTabWhenAdopted(t.address, name).catch(() => false) : false;
						return { agent, name, address: t.address, tabbed };
					} catch (e) {
						ctx.ui.notify(`${name}: ${(e as Error).message}`, "error");
						return undefined;
					}
				}),
			);

			const herd = started.filter((s) => s !== undefined);
			if (!herd.length) return;
			for (const s of herd)
				if (space && !s.tabbed) ctx.ui.notify(`${s.name} (${s.address}) started, but its tab wasn't found to rename`, "warning");
			ctx.ui.notify(
				`Herd: ${herd.map((s) => `${s.name} (${s.address})`).join(", ")}${outlive ? " · outlive" : ""}`,
				"info",
			);

			// Tell the orchestrator model who it can delegate to, on its next turn.
			pi.sendMessage(
				{
					customType: "herd",
					display: true,
					content: [
						`Herd started from this pi (${self}). Members, reachable with hc (see the herd-my-pi skill):`,
						...herd.map((s) => `- ${s.name} (${s.address}): ${s.agent.description || s.agent.name}`),
					].join("\n"),
				},
				{ deliverAs: "nextTurn" },
			);
		},
	});
}
