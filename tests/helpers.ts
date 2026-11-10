import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export function sandbox(t: TestContext): string {
	const dir = mkdtempSync(join(tmpdir(), "herd-test-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	return dir;
}

export interface Call { command: string; args: string[] }

/** PATH contains only these fakes: a test can never fall through to the user's hc. */
export function fakeCLI(t: TestContext, body: string): { calls: () => Call[] } {
	const dir = sandbox(t);
	const bin = join(dir, "bin");
	const log = join(dir, "calls.jsonl");
	mkdirSync(bin);
	writeFileSync(log, "");
	for (const command of ["hc", "herdr-app"]) {
		writeFileSync(join(bin, command), `#!${process.execPath}\nimport { appendFileSync } from 'node:fs';\nconst command = ${JSON.stringify(command)};\nconst args = process.argv.slice(2);\nappendFileSync(${JSON.stringify(log)}, JSON.stringify({ command, args }) + '\\n');\n${body}\n`, { mode: 0o700 });
	}
	const oldPath = process.env.PATH;
	process.env.PATH = bin;
	t.after(() => {
		if (oldPath === undefined) delete process.env.PATH;
		else process.env.PATH = oldPath;
	});
	return { calls: () => readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)) };
}

export function setEnv(t: TestContext, key: string, value?: string): void {
	const previous = process.env[key];
	if (value === undefined) delete process.env[key];
	else process.env[key] = value;
	t.after(() => {
		if (previous === undefined) delete process.env[key];
		else process.env[key] = previous;
	});
}

export function sessionFile(dir: string, entries: unknown[], tail = ""): string {
	const file = join(dir, "session.jsonl");
	writeFileSync(file, entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n" + tail);
	return file;
}

export const header = { type: "session", version: 3, id: "test", cwd: "/test", timestamp: "2026-01-01T00:00:00.000Z" };
export const message = (id: string, parentId: string | null, role: string, content: unknown, stopReason = "stop") => ({
	type: "message", id, parentId, timestamp: header.timestamp,
	message: { role, content, stopReason, timestamp: 1 },
});
export const assistant = (id: string, parentId: string, text: string, stopReason = "stop") =>
	message(id, parentId, "assistant", [{ type: "text", text }], stopReason);

export const model: Model<Api> = {
	id: "test-model", provider: "test-provider", name: "Test model", api: "openai-completions",
	baseUrl: "https://example.invalid", reasoning: true, input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 10000, maxTokens: 1000,
};

export function context(models: Model<Api>[] = [model]): ExtensionContext {
	return {
		mode: "tui", hasUI: true, scopedModels: [], cwd: "/test",
		modelRegistry: {
			getAll: () => models, getAvailable: () => models,
			find: (provider: string, id: string) => models.find((m) => m.provider === provider && m.id === id),
			getError: () => undefined, hasConfiguredAuth: () => true,
			refresh: async () => ({ errors: new Map(), aborted: false }),
		},
		ui: {},
	} as unknown as ExtensionContext;
}
