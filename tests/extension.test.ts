import assert from "node:assert/strict";
import { readFileSync, rmSync, statSync } from "node:fs";
import test from "node:test";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext, ExtensionToolContext, ToolDefinition } from "@earendil-works/pi-coding-agent";
import herd, { uniqueName } from "../extensions/herd.ts";
import { assistant, context, fakeCLI, header, message, sandbox, sessionFile, setEnv } from "./helpers.ts";

type Command = Parameters<ExtensionAPI["registerCommand"]>[1];
function register() {
	const events = new Map<string, unknown>();
	const tools = new Map<string, ToolDefinition>();
	const commands = new Map<string, Command>();
	const messages: unknown[][] = [];
	herd({
		on: (name: string, handler: unknown) => events.set(name, handler),
		registerTool: (tool: ToolDefinition) => tools.set(tool.name, tool),
		registerCommand: (name: string, command: Command) => commands.set(name, command),
		sendMessage: (...args: unknown[]) => messages.push(args),
	} as unknown as ExtensionAPI);
	return { events, tools, commands, messages };
}

function commandContext(t: Parameters<typeof sandbox>[0]): { ctx: ExtensionCommandContext; notifications: string[] } {
	const ctx = context() as ExtensionCommandContext;
	ctx.cwd = sandbox(t);
	const notifications: string[] = [];
	ctx.ui.notify = (text) => { notifications.push(text); };
	ctx.ui.confirm = async () => false;
	ctx.ui.custom = (async (factory) => {
		const { promise, resolve } = Promise.withResolvers<unknown>();
		const theme = { fg: (_color: string, text: string) => text, bg: (_color: string, text: string) => text, bold: (text: string) => text };
		const keys = { matches: (data: string, key: string) => data === "enter" && key === "tui.select.confirm" };
		const view = await factory({ requestRender() {} } as never, theme as never, keys as never, resolve);
		view.handleInput?.("a");
		view.handleInput?.("enter");
		return promise;
	}) as ExtensionContext["ui"]["custom"];
	return { ctx, notifications };
}

test("registration does not run any CLI or spawn an agent", () => {
	const registered = register();
	assert.deepEqual([...registered.events.keys()], ["session_start"]);
	assert.deepEqual([...registered.tools.keys()], ["herd_read"]);
	assert.deepEqual([...registered.commands.keys()], ["herd"]);
	assert.deepEqual(registered.messages, []);
});

test("uniqueName normalizes, reserves, and bounds names even with 1000 collisions", () => {
	const taken = new Set<string>();
	assert.equal(uniqueName(" My Explorer! ", taken), "my-explorer");
	assert.equal(uniqueName("My Explorer", taken), "my-explorer-2");
	assert.equal(uniqueName("☃", taken), "agent");
	const long = "a".repeat(80);
	for (let i = 0; i < 1001; i++) assert.match(uniqueName(long, taken), /^[a-z0-9_-]{1,32}$/);
	assert.equal(taken.size, 1004);
});

test("publishes and clears session labels without starting commands", async (t) => {
	setEnv(t, "HC_TERMINAL_ID", "t-self");
	const cli = fakeCLI(t, "console.log('{}');");
	const handler = register().events.get("session_start") as (event: unknown, ctx: ExtensionContext) => Promise<void>;
	const ctx = context();
	ctx.sessionManager = { getSessionFile: () => "/a path/session.jsonl" } as ExtensionContext["sessionManager"];
	await handler({}, ctx);
	ctx.sessionManager = { getSessionFile: () => undefined } as ExtensionContext["sessionManager"];
	await handler({}, ctx);
	assert.deepEqual(cli.calls().map((call) => call.args.at(-1)), ["herd.session=/a path/session.jsonl", "herd.session="]);
	setEnv(t, "HC_TERMINAL_ID");
	await handler({}, ctx);
	assert.equal(cli.calls().length, 2);
});

test("herd_read returns ready replies/status and refuses remote or unpublished sessions", async (t) => {
	const file = sessionFile(sandbox(t), [header, message("u", null, "user", "Request"), assistant("a", "u", "Complete answer")]);
	fakeCLI(t, `console.log(JSON.stringify({ address: 't-member', name: 'scout', state: 'live', status: { state: 'done' }, labels: args[1] === 'unpublished' ? {} : { 'herd.session': ${JSON.stringify(file)} } }));`);
	const tool = register().tools.get("herd_read")!;
	const result = await tool.execute("call", { member: "scout" }, undefined, undefined, {} as ExtensionToolContext);
	assert.match(JSON.stringify(result.content), /Complete answer/);
	assert.equal((result.details as { readiness: string }).readiness, "ready");
	assert.match(JSON.stringify(result.content), /Latest prompt: u/);
	await assert.rejects(tool.execute("call", { member: "remote/t1" }, undefined, undefined, {} as ExtensionToolContext), /local hc members only/);
	await assert.rejects(tool.execute("call", { member: "unpublished" }, undefined, undefined, {} as ExtensionToolContext), /hasn't published a pi session/);
});

test("herd_read truncates large output and preserves full text in a private temporary file", async (t) => {
	const answer = "Long answer\n".repeat(6000);
	const file = sessionFile(sandbox(t), [header, message("u", null, "user", "Request"), assistant("a", "u", answer)]);
	fakeCLI(t, `console.log(JSON.stringify({ address: 't-member', state: 'finished', labels: { 'herd.session': ${JSON.stringify(file)} } }));`);
	for (const params of [{ member: "scout" }, { member: "scout", last: 1 }]) {
		const result = await register().tools.get("herd_read")!.execute("call", params, undefined, undefined, {} as ExtensionToolContext);
		const outputFile = (result.details as { outputFile: string }).outputFile;
		t.after(() => rmSync(outputFile.replace(/\/replies\.md$/, ""), { recursive: true, force: true }));
		assert.ok(outputFile);
		assert.match(JSON.stringify(result.content), /Output truncated/);
		assert.ok(JSON.stringify(result.content).length < 52 * 1024);
		assert.ok(readFileSync(outputFile, "utf8").includes(answer.trim()));
		assert.equal(statSync(outputFile).mode & 0o777, 0o600);
		assert.equal((result.details as { readiness: string }).readiness, params.last ? "history" : "ready");
	}
});

test("/herd refuses noninteractive or non-hc sessions before invoking a CLI", async (t) => {
	const { ctx, notifications } = commandContext(t);
	const cli = fakeCLI(t, "throw new Error('must not run');");
	const command = register().commands.get("herd")!;
	setEnv(t, "HC_TERMINAL_ID");
	await command.handler("", ctx);
	setEnv(t, "HC_TERMINAL_ID", "t-self");
	ctx.mode = "rpc";
	await command.handler("", ctx);
	assert.match(notifications[0], /inside a herdr-core/);
	assert.match(notifications[1], /interactive mode/);
	assert.deepEqual(cli.calls(), []);
});

test("/herd builds background invocations and queues context using fake CLIs only", async (t) => {
	setEnv(t, "HC_TERMINAL_ID", "t-self");
	const { ctx, notifications } = commandContext(t);
	const cli = fakeCLI(t, `
if (args[0] === 'ls') console.log(JSON.stringify({ terminals: [{ address: 't-other', name: 'explorer', state: 'live' }] }));
else if (args[0] === 'run') console.log(JSON.stringify({ address: 't-' + args[args.indexOf('--name') + 1], state: 'live' }));
else console.log(JSON.stringify({ address: 't-self', state: 'live', labels: {} }));`);
	const registered = register();
	await registered.commands.get("herd")!.handler("--outlive", ctx);
	const runs = cli.calls().filter((call) => call.args[0] === "run");
	assert.equal(runs.length, 3);
	assert.ok(runs.every((call) => call.args.includes("--bg") && call.args.includes("--outlive-parent")));
	assert.ok(runs.every((call) => call.args.includes("herd.parent=t-self")));
	assert.ok(runs.every((call) => !call.args.includes("--model")), "portable defaults must not pin a provider");
	assert.ok(runs.every((call) => call.args.some((arg) => arg.includes('orchestrator is the pi at hc address t-self'))));
	assert.ok(runs.some((call) => call.args.includes("explorer-2")));
	assert.equal(registered.messages.length, 1);
	assert.deepEqual(registered.messages[0][1], { deliverAs: "nextTurn" });
	assert.match(notifications.at(-1)!, /Herd:.*outlive/);
});

test("latest pending prompt never falls back to an older completed report, even with stale done status", async (t) => {
	const file = sessionFile(sandbox(t), [header,
		message("u1", null, "user", "Old request"), assistant("a1", "u1", "OLD REPORT"),
		message("u2", "a1", "user", "Current request"),
	]);
	fakeCLI(t, `console.log(JSON.stringify({ address: 't-member', state: 'live', status: { state: 'done' }, labels: { 'herd.session': ${JSON.stringify(file)} } }));`);
	const result = await register().tools.get("herd_read")!.execute("call", { member: "scout" }, undefined, undefined, {} as ExtensionToolContext);
	assert.doesNotMatch(JSON.stringify(result.content), /OLD REPORT/);
	assert.equal((result.details as { readiness: string }).readiness, "not_ready");
	assert.equal((result.details as { latestPromptId: string }).latestPromptId, "u2");
});

test("working runner never exposes an old report while a new request has not reached the session", async (t) => {
	const file = sessionFile(sandbox(t), [header, message("u1", null, "user", "Old request"), assistant("a1", "u1", "OLD REPORT")]);
	fakeCLI(t, `console.log(JSON.stringify({ address: 't-member', state: 'live', status: { state: 'working' }, labels: { 'herd.session': ${JSON.stringify(file)} } }));`);
	const result = await register().tools.get("herd_read")!.execute("call", { member: "scout" }, undefined, undefined, {} as ExtensionToolContext);
	assert.doesNotMatch(JSON.stringify(result.content), /OLD REPORT/);
	assert.equal((result.details as { readiness: string }).readiness, "not_ready");
});

test("a done message in a tool-using turn is incomplete until its final assistant message", async (t) => {
	const dir = sandbox(t);
	const entries = [header, message("u1", null, "user", "Old request"), assistant("a1", "u1", "OLD REPORT"),
		message("u2", "a1", "user", "Current request"), assistant("a2", "u2", "Current report before hc send done", "toolUse")];
	const file = sessionFile(dir, entries);
	fakeCLI(t, `console.log(JSON.stringify({ address: 't-member', state: 'live', status: { state: 'done' }, labels: { 'herd.session': ${JSON.stringify(file)} } }));`);
	const tool = register().tools.get("herd_read")!;
	const pending = await tool.execute("call", { member: "scout" }, undefined, undefined, {} as ExtensionToolContext);
	assert.equal((pending.details as { readiness: string }).readiness, "incomplete");
	assert.doesNotMatch(JSON.stringify(pending.content), /OLD REPORT/);
	sessionFile(dir, [...entries, assistant("a3", "a2", "")]);
	const complete = await tool.execute("call", { member: "scout" }, undefined, undefined, {} as ExtensionToolContext);
	assert.equal((complete.details as { readiness: string }).readiness, "ready");
	assert.match(JSON.stringify(complete.content), /Current report before hc send done/);
	sessionFile(dir, [...entries, assistant("a3", "a2", ""), message("u3", "a3", "user", "Next request")]);
	const next = await tool.execute("call", { member: "scout" }, undefined, undefined, {} as ExtensionToolContext);
	assert.equal((next.details as { readiness: string }).readiness, "not_ready");
	assert.doesNotMatch(JSON.stringify(next.content), /Current report before hc send done/);
});

for (const stopReason of ["aborted", "error", "length"]) {
	test(`latest ${stopReason} turn is incomplete, never the prior successful report`, async (t) => {
		const file = sessionFile(sandbox(t), [header, message("u1", null, "user", "Old request"), assistant("a1", "u1", "OLD REPORT"),
			message("u2", "a1", "user", "Current request"), assistant("a2", "u2", "", stopReason)]);
		fakeCLI(t, `console.log(JSON.stringify({ address: 't-member', state: 'finished', labels: { 'herd.session': ${JSON.stringify(file)} } }));`);
		const result = await register().tools.get("herd_read")!.execute("call", { member: "scout" }, undefined, undefined, {} as ExtensionToolContext);
		assert.doesNotMatch(JSON.stringify(result.content), /OLD REPORT/);
		assert.equal((result.details as { readiness: string }).readiness, "incomplete");
	});
}

test("blocked lookup returns exact waiting response before touching cyclic, missing, or inaccessible sessions", async (t) => {
	const dir = sandbox(t);
	const file = sessionFile(dir, [header, message("cycle", "cycle", "user", "Must not inspect")]);
	const files = [file, `${file}.missing`, dir];
	const cli = fakeCLI(t, `console.log(JSON.stringify({ address: 't-member', state: 'live', status: { state: 'blocked' }, labels: { 'herd.session': ${JSON.stringify(files)}[Number(args[1])] } }));`);
	const tool = register().tools.get("herd_read")!;
	for (let i = 0; i < files.length; i++) {
		const result = await tool.execute("call", { member: String(i) }, undefined, undefined, {} as ExtensionToolContext);
		assert.deepEqual(result.content, [{ type: "text", text: "Noted, waiting on user" }]);
		assert.notEqual(result.isError, true);
	}
	assert.deepEqual(cli.calls().map((call) => call.args), [["get", "0", "--json"], ["get", "1", "--json"], ["get", "2", "--json"]]);
});

test("explicit last requests preserve chronological history without claiming current readiness", async (t) => {
	const file = sessionFile(sandbox(t), [header, message("u1", null, "user", "Old request"), assistant("a1", "u1", "OLD REPORT"),
		message("u2", "a1", "user", "Current request"), assistant("a2", "u2", "Current progress", "toolUse"),
		message("u3", "a2", "user", "Pending request")]);
	fakeCLI(t, `console.log(JSON.stringify({ address: 't-member', state: 'live', status: { state: 'working' }, labels: { 'herd.session': ${JSON.stringify(file)} } }));`);
	const result = await register().tools.get("herd_read")!.execute("call", { member: "scout", last: 2 }, undefined, undefined, {} as ExtensionToolContext);
	assert.equal((result.details as { readiness: string }).readiness, "history");
	assert.match(JSON.stringify(result.content), /history/i);
	assert.ok(JSON.stringify(result.content).indexOf("OLD REPORT") < JSON.stringify(result.content).indexOf("Current progress"));
});

test("optional after prompt guard rejects an unchanged old prompt even when runner says done", async (t) => {
	const file = sessionFile(sandbox(t), [header, message("u1", null, "user", "Old request"), assistant("a1", "u1", "OLD REPORT")]);
	fakeCLI(t, `console.log(JSON.stringify({ address: 't-member', state: 'live', status: { state: 'done' }, labels: { 'herd.session': ${JSON.stringify(file)} } }));`);
	const result = await register().tools.get("herd_read")!.execute("call", { member: "scout", after: "u1" }, undefined, undefined, {} as ExtensionToolContext);
	assert.doesNotMatch(JSON.stringify(result.content), /OLD REPORT/);
	assert.equal((result.details as { readiness: string }).readiness, "not_ready");
});

test("after cursor must be older on the active branch; unknown or abandoned cursors cannot prove freshness", async (t) => {
	const file = sessionFile(sandbox(t), [header, message("u1", null, "user", "Old request"), assistant("a1", "u1", "OLD REPORT"),
		message("abandoned", "a1", "user", "Other branch"), assistant("abandoned-answer", "abandoned", "Other report"),
		message("u2", "a1", "user", "Current request"), assistant("a2", "u2", "CURRENT REPORT")]);
	fakeCLI(t, `console.log(JSON.stringify({ address: 't-member', state: 'live', status: { state: 'idle' }, labels: { 'herd.session': ${JSON.stringify(file)} } }));`);
	const tool = register().tools.get("herd_read")!;
	for (const after of ["missing", "abandoned", "u2"]) {
		const result = await tool.execute("call", { member: "scout", after }, undefined, undefined, {} as ExtensionToolContext);
		assert.equal((result.details as { readiness: string }).readiness, "not_ready");
		assert.doesNotMatch(JSON.stringify(result.content), /CURRENT REPORT|OLD REPORT/);
	}
	const ready = await tool.execute("call", { member: "scout", after: "u1" }, undefined, undefined, {} as ExtensionToolContext);
	assert.equal((ready.details as { readiness: string }).readiness, "ready");
	assert.equal((ready.details as { latestPromptId: string }).latestPromptId, "u2");
	assert.match(JSON.stringify(ready.content), /CURRENT REPORT/);
	assert.doesNotMatch(JSON.stringify(ready.content), /OLD REPORT/);
	await assert.rejects(tool.execute("call", { member: "scout", after: "u1", last: 2 }, undefined, undefined, {} as ExtensionToolContext), /not both/);
});

test("working current progress cannot establish readiness", async (t) => {
	const file = sessionFile(sandbox(t), [header, message("u1", null, "user", "Old request"), assistant("a1", "u1", "OLD REPORT"),
		message("u2", "a1", "user", "Current request"), assistant("a2", "u2", "CURRENT PROGRESS", "toolUse")]);
	fakeCLI(t, `console.log(JSON.stringify({ address: 't-member', state: 'live', status: { state: 'working' }, labels: { 'herd.session': ${JSON.stringify(file)} } }));`);
	const result = await register().tools.get("herd_read")!.execute("call", { member: "scout" }, undefined, undefined, {} as ExtensionToolContext);
	assert.equal((result.details as { readiness: string }).readiness, "not_ready");
	assert.equal((result.details as { latestPromptId: string }).latestPromptId, "u2");
	assert.doesNotMatch(JSON.stringify(result.content), /OLD REPORT|CURRENT PROGRESS/);
});

test("a completed-looking session without runner completion is not ready", async (t) => {
	const file = sessionFile(sandbox(t), [header, message("u1", null, "user", "Request"), assistant("a1", "u1", "REPORT")]);
	fakeCLI(t, `console.log(JSON.stringify({ address: 't-member', state: 'live', labels: { 'herd.session': ${JSON.stringify(file)} } }));`);
	const result = await register().tools.get("herd_read")!.execute("call", { member: "scout" }, undefined, undefined, {} as ExtensionToolContext);
	assert.equal((result.details as { readiness: string }).readiness, "not_ready");
	assert.doesNotMatch(JSON.stringify(result.content), /REPORT/);
});

test("blocked lookup takes precedence over missing session labels and conflicting read modes", async (t) => {
	const cli = fakeCLI(t, "console.log(JSON.stringify({ address: 't-member', state: 'live', status: { state: 'blocked' } }));");
	const result = await register().tools.get("herd_read")!.execute("call", { member: "scout", after: "u1", last: 2 }, undefined, undefined, {} as ExtensionToolContext);
	assert.deepEqual(result.content, [{ type: "text", text: "Noted, waiting on user" }]);
	assert.equal((result.details as { readiness: string }).readiness, "blocked");
	assert.deepEqual(cli.calls(), [{ command: "hc", args: ["get", "scout", "--json"] }]);
});
