import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { type AgentTemplate, copyShippedAgents, loadAgents, PROJECT_AGENTS_DIR, SHIPPED_AGENTS_DIR } from "../src/agents.ts";
import { Type } from "typebox";
import { getTerminal, liveTerminals, renameTab, runBackground, setLabels, type Terminal, tabOf } from "../src/hc.ts";
import { modelRef } from "../src/models.ts";
import { pickAgents } from "../src/picker.ts";
import { lastReplies } from "../src/session.ts";

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
	// Publish this pi's session file on its terminal so herd members can herd_read it.
	// session_start also fires after /new, /resume and forks, which change the file.
	pi.on("session_start", async (_event, ctx) => {
		const self = process.env.HC_TERMINAL_ID;
		const file = ctx.sessionManager.getSessionFile();
		if (self && file) await setLabels(self, { "herd.session": file }).catch(() => {});
	});

	pi.registerTool({
		name: "herd_read",
		label: "Herd read",
		description:
			"Read a herd member's latest replies straight from its pi session: complete text, not a screen capture. " +
			"Works on finished members too.",
		promptSnippet: "Read another herd member's last replies from its pi session",
		promptGuidelines: [
			"Use herd_read to get a herd member's answer after it reports done; use hc read only to see what it is doing right now.",
		],
		parameters: Type.Object({
			member: Type.String({ description: "The member's hc name (e.g. reviewer) or address (e.g. t1x)" }),
			last: Type.Optional(
				Type.Integer({ minimum: 1, maximum: 10, description: "How many recent replies, oldest first (default 1)" }),
			),
		}),
		async execute(_id, params) {
			const member = await getTerminal(params.member);
			const file = member.labels?.["herd.session"];
			if (!file)
				throw new Error(`${params.member} (${member.address}) hasn't published a pi session; is herd-my-pi loaded in it?`);
			const replies = lastReplies(file, params.last ?? 1);
			const who = `${member.name ?? member.address} (${member.address}, ${member.state})`;
			const text = replies.length
				? replies.map((r, i) => `## ${who}, reply ${replies.length - i} from the end\n\n${r}`).join("\n\n")
				: `${who} has no finished replies yet.`;
			return { content: [{ type: "text", text }], details: { member: member.address, file, count: replies.length } };
		},
	});

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
			// Only terminals Herdr itself started carry herdr.tab; hc-started ones are found by address.
			const myTab = me.labels?.["herdr.tab"] ?? (space ? await tabOf(self).catch(() => undefined) : undefined);
			if (myTab) await renameTab(myTab, ORCHESTRATOR_TAB).catch(() => {});

			const { agents, source } = await chooseAgents(ctx);
			if (!agents.length) return ctx.ui.notify(`No agent templates (*.md) in ${source}`, "warning");

			const picked = await pickAgents(ctx, agents, source);
			if (!picked.length) return;

			const taken = new Set((await liveTerminals()).map((t) => t.name).filter((n): n is string => !!n));
			const started = await Promise.all(
				picked.map(async ({ agent, model, thinking }) => {
					const name = uniqueName(agent.name, taken);
					const piArgs = ["--name", name, "--append-system-prompt", systemPrompt(agent, name, self)];
					// The exact model the picker resolved, so the sub-agent can't resolve the pattern differently.
					if (model) piArgs.push("--model", modelRef(model));
					if (thinking) piArgs.push("--thinking", thinking);
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
						"",
						"Offload to them: delegate research, reviews and scoped changes that fit a member, in parallel when independent,",
						"and read their answers with herd_read. Do it yourself only for a single quick lookup.",
					].join("\n"),
				},
				{ deliverAs: "nextTurn" },
			);
		},
	});
}
