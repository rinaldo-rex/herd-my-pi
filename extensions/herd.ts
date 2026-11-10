import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type AgentToolResult, type ExtensionAPI, type ExtensionCommandContext, truncateHead } from "@earendil-works/pi-coding-agent";
import { type AgentTemplate, copyShippedAgents, loadAgents, PROJECT_AGENTS_DIR, SHIPPED_AGENTS_DIR } from "../src/agents.ts";
import { Type } from "typebox";
import { getTerminal, liveTerminals, renameTab, runBackground, setLabels, type Terminal, tabOf } from "../src/hc.ts";
import { modelRef } from "../src/models.ts";
import { pickAgents } from "../src/picker.ts";
import { readPromptReplies } from "../src/session.ts";

const ORCHESTRATOR_TAB = "Orchestrator";

interface HerdReadDetails {
	member: string;
	readiness: "ready" | "not_ready" | "incomplete" | "history" | "blocked";
	count: number;
	file?: string;
	outputFile?: string;
	latestPromptId?: string;
	latestStopReason?: string;
}

// hc names: unique among live terminals, 1-32 of a-z 0-9 - _
export function uniqueName(base: string, taken: Set<string>): string {
	const clean = base.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28) || "agent";
	let name = clean;
	for (let n = 2; taken.has(name); n++) {
		const suffix = `-${n}`;
		name = `${clean.slice(0, 32 - suffix.length)}${suffix}`;
	}
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
		if (!self) return;
		// No file (--no-session): clear the label rather than leave an old session's path.
		const file = ctx.sessionManager.getSessionFile() ?? "";
		await setLabels(self, { "herd.session": file }).catch((e) =>
			ctx.ui.notify(`herd: couldn't publish this session for herd_read: ${(e as Error).message}`, "warning"),
		);
	});

	pi.registerTool({
		name: "herd_read",
		label: "Herd read",
		description:
			"Read a local herd member's current result with explicit readiness and latest prompt ID; ready means report available, not task success. " +
			"Pass last only for explicitly labeled historical replies, or after to require a newer prompt than a previous read. " +
			"Blocked members are not inspected. Works on finished members too. Output is limited to 50 KiB or 2000 lines; longer replies are saved to a temporary file.",
		promptSnippet: "Read another herd member's last replies from its pi session",
		promptGuidelines: [
			"Use herd_read after the runner reports a completed turn, not merely a done message. Treat only readiness ready as a current result. Never inspect blocked members; wait for the user.",
		],
		parameters: Type.Object({
			member: Type.String({ description: "The member's hc name (e.g. reviewer) or address (e.g. t1x)" }),
			last: Type.Optional(
				Type.Integer({ minimum: 1, maximum: 10, description: "Explicit history mode: how many answered prompts to read, oldest first. Omit to check only the current prompt." }),
			),
			after: Type.Optional(Type.String({ minLength: 1, description: "A previously observed latestPromptId on this active branch. Accept a current result only for a newer prompt. Cannot combine with last." })),
		}),
		async execute(_id, params, signal): Promise<AgentToolResult<HerdReadDetails>> {
			if (params.member.includes("/")) throw new Error("herd_read supports local hc members only, not remote machine/address targets");
			const member = await getTerminal(params.member, signal);
			if (member.status?.state === "blocked")
				return {
					content: [{ type: "text", text: "Noted, waiting on user" }],
					details: { member: member.address, readiness: "blocked", count: 0 },
				};
			if (params.after !== undefined && params.last !== undefined)
				throw new Error("Use after for current-result freshness or last for explicit history, not both");
			const file = member.labels?.["herd.session"];
			if (!file)
				throw new Error(
					`${params.member} (${member.address}) hasn't published a pi session. It may have started before herd_read existed (/reload it), or run without herd-my-pi or a session file.`,
				);
			const prompts = readPromptReplies(file);
			const latest = prompts.at(-1);
			const status = member.state === "finished" ? "exited" : (member.status?.state ?? "live");
			const who = `${member.name ?? member.address} (${member.address}, ${status})`;
			let readiness: HerdReadDetails["readiness"];
			let body: string;
			let count = 0;
			if (params.last !== undefined) {
				readiness = "history";
				const replies = prompts.filter((reply) => reply.text).slice(-params.last);
				count = replies.length;
				body = "Explicit history, not a current-result check.\n\n" + (replies.length
					? replies.map((reply, i) => `### Prompt ${reply.promptId}: answer ${replies.length - i} from the end\n\n${reply.text}`).join("\n\n")
					: "No historical answers yet.");
			} else {
				const cursor = params.after === undefined ? undefined : prompts.findIndex((reply) => reply.promptId === params.after);
				if (cursor !== undefined && (cursor < 0 || cursor === prompts.length - 1)) {
					readiness = "not_ready";
					body = cursor < 0 ? "The after prompt is not on this active branch; freshness cannot be established."
						: "No newer prompt has reached the session yet.";
				} else if (status === "working") {
					readiness = "not_ready";
					body = "The runner is still working. A done message is not completion; wait for its completed turn.";
				} else if (!latest || latest.stopReason === undefined) {
					readiness = "not_ready";
					body = "No answer for the latest prompt yet.";
				} else if (member.status?.state === "error" || latest.stopReason !== "stop" || !latest.text) {
					readiness = "incomplete";
					body = `Latest answer is incomplete (stop reason: ${latest.stopReason}).`;
					if (latest.text) {
						body += `\n\n${latest.text}`;
						count = 1;
					}
				} else if (status !== "done" && status !== "idle" && status !== "exited") {
					readiness = "not_ready";
					body = "Runner completion is not established; this is not a ready current result.";
				} else {
					readiness = "ready";
					body = latest.text;
					count = 1;
				}
			}
			const fullText = `## ${who}: ${readiness}\nLatest prompt: ${latest?.promptId ?? "none"}\n\n${body}`;
			const truncation = truncateHead(fullText);
			let text = truncation.content;
			let outputFile: string | undefined;
			if (truncation.truncated) {
				outputFile = join(mkdtempSync(join(tmpdir(), "herd-read-")), "replies.md");
				writeFileSync(outputFile, fullText, { mode: 0o600 });
				text += `\n\n[Output truncated. Full replies saved to: ${outputFile}]`;
			}
			return { content: [{ type: "text", text }], details: { member: member.address, file, count, outputFile, readiness, latestPromptId: latest?.promptId, latestStopReason: latest?.stopReason } };
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
							labels: {
								...(space && { "herdr.space": space }),
								"herd.parent": self,
								"herd.role": agent.name,
								"herd.template": agent.file,
							},
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
						...herd.map((s) => `- ${s.name} (${s.address}): ${s.agent.description || s.agent.name} [${s.agent.file}]`),
						"",
						"On every prompt from the person, use the herd as you see fit, according to what each member is for",
						"(its template file above), with as little back and forth as possible. Read answers with herd_read.",
					].join("\n"),
				},
				{ deliverAs: "nextTurn" },
			);
		},
	});
}
