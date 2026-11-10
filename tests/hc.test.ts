import assert from "node:assert/strict";
import test from "node:test";
import { getTerminal, liveTerminals, renameTab, runBackground, setLabels, tabOf } from "../src/hc.ts";
import { fakeCLI } from "./helpers.ts";

test("CLI helpers pass literal argv, labels, cwd, and lifetime without invoking a shell", async (t) => {
	const cli = fakeCLI(t, `
if (command === 'herdr-app') console.log(JSON.stringify(args[0] === 'ls' ? { spaces: [{ tabs: [{ id: 'tab-1', terminals: [{ terminal: 't1' }] }] }] } : {}));
else console.log(JSON.stringify(args[0] === 'ls' ? { terminals: [{ address: 't1', state: 'live' }] } : { address: 't1', state: 'live' }));`);
	assert.equal((await getTerminal("literal;$(echo no)")).address, "t1");
	assert.equal((await liveTerminals()).length, 1);
	await setLabels("t1", { "herd.session": "/a path/session.jsonl" });
	await runBackground({ name: "scout", cwd: "/a path", labels: { "herd.parent": "t0" }, outliveParent: true, argv: ["pi", "--append-system-prompt", "Quoted '$HOME'\nPrompt"] });
	assert.equal(await tabOf("t1"), "tab-1");
	assert.equal(await tabOf("not-adopted"), undefined);
	await renameTab("tab-1", "A tab title");
	assert.deepEqual(cli.calls(), [
		{ command: "hc", args: ["get", "literal;$(echo no)", "--json"] },
		{ command: "hc", args: ["ls", "--json"] },
		{ command: "hc", args: ["label", "t1", "--json", "herd.session=/a path/session.jsonl"] },
		{ command: "hc", args: ["run", "--bg", "--json", "--name", "scout", "--cwd", "/a path", "--label", "herd.parent=t0", "--outlive-parent", "--", "pi", "--append-system-prompt", "Quoted '$HOME'\nPrompt"] },
		{ command: "herdr-app", args: ["ls"] },
		{ command: "herdr-app", args: ["ls"] },
		{ command: "herdr-app", args: ["do", "tab.rename", "--id", "tab-1", "--name", "A tab title"] },
	]);
});

test("runBackground does not detach members unless requested", async (t) => {
	const cli = fakeCLI(t, "console.log(JSON.stringify({ address: 't2', state: 'live' }));");
	await runBackground({ name: "agent", cwd: "/test", labels: {}, outliveParent: false, argv: ["pi"] });
	assert.ok(!cli.calls()[0].args.includes("--outlive-parent"));
});

for (const error of [{ message: "No such terminal" }, "No such terminal"]) {
	test(`formats structured CLI errors (${typeof error})`, async (t) => {
		fakeCLI(t, `console.error(JSON.stringify({ error: ${JSON.stringify(error)} })); process.exitCode = 3;`);
		await assert.rejects(getTerminal("missing"), { message: "hc get: No such terminal" });
	});
}

test("reports invalid JSON with command context", async (t) => {
	fakeCLI(t, "console.log('invalid JSON');");
	await assert.rejects(getTerminal("t1"), /hc get:.*invalid JSON/s);
});

test("reports a missing CLI with command context", async (t) => {
	fakeCLI(t, "console.log('{}');");
	process.env.PATH += "/missing";
	await assert.rejects(getTerminal("t1"), /hc get:.*ENOENT/s);
});

test("stalled CLI commands time out even if they ignore SIGTERM", { timeout: 15_000 }, async (t) => {
	fakeCLI(t, "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);");
	await assert.rejects(getTerminal("t1"), /hc get: command timed out or was terminated/);
});

test("herd_read lookup can be aborted", async (t) => {
	fakeCLI(t, "setInterval(() => {}, 1000);");
	await assert.rejects(getTerminal("t1", AbortSignal.timeout(30)), /hc get:.*abort/i);
});
