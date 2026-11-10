import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { lastReplies, readPromptReplies } from "../src/session.ts";
import { assistant, header, message, sandbox, sessionFile } from "./helpers.ts";

test("missing and empty sessions have no replies", (t) => {
	const dir = sandbox(t);
	assert.deepEqual(lastReplies(join(dir, "not-created.jsonl"), 1), []);
	assert.deepEqual(lastReplies(sessionFile(dir, []), 1), []);
});

test("joins all assistant text around tool calls and selects recent answered prompts", (t) => {
	const file = sessionFile(sandbox(t), [
		header,
		message("u1", null, "user", "First request"),
		message("a1", "u1", "assistant", [
			{ type: "thinking", thinking: "Private reasoning must not appear" },
			{ type: "text", text: "  First " }, { type: "text", text: "answer  " },
			{ type: "toolCall", id: "call", name: "bash", arguments: {} },
		], "toolUse"),
		message("tool", "a1", "toolResult", [{ type: "text", text: "Tool output must not appear" }]),
		assistant("a2", "tool", "Follow-up note"),
		message("u2", "a2", "user", [{ type: "text", text: "Second request" }]),
		assistant("a3", "u2", "Second answer"),
		message("u3", "a3", "user", "Pending request"),
	], '{"type":"message"');
	assert.deepEqual(lastReplies(file, 1), ["Second answer"]);
	assert.deepEqual(lastReplies(file, 10), ["First answer\n\nFollow-up note", "Second answer"]);
});

test("walks the active raw branch through compaction without leaking abandoned answers", (t) => {
	const file = sessionFile(sandbox(t), [
		header, message("u1", null, "user", "Initial"), assistant("a1", "u1", "Keep me"),
		message("abandoned-user", "a1", "user", "Old branch"), assistant("abandoned", "abandoned-user", "Do not include"),
		{ type: "compaction", id: "compact", parentId: "a1", summary: "summary", firstKeptEntryId: "a1", tokensBefore: 42 },
		{ type: "custom_message", id: "custom", parentId: "compact", customType: "note", content: "Not a human prompt", display: false },
		message("u2", "custom", "user", "New branch"), assistant("a2", "u2", "Current branch"),
		{ type: "session_info", id: "info", parentId: "a2", name: "Metadata leaf" },
	]);
	assert.deepEqual(lastReplies(file, 10), ["Keep me", "Current branch"]);
});

test("marks aborted and failed turns without dropping their partial text", (t) => {
	const file = sessionFile(sandbox(t), [
		header, message("u1", null, "user", "One"), assistant("a1", "u1", "Partial one", "aborted"),
		message("u2", "a1", "user", "Two"), assistant("a2", "u2", "Partial two", "toolUse"),
		assistant("a3", "a2", "", "error"),
	]);
	assert.deepEqual(lastReplies(file, 2), ["(interrupted: aborted)\n\nPartial one", "(interrupted: error)\n\nPartial two"]);
});

test("migrates legacy sessions only in memory", (t) => {
	const file = sessionFile(sandbox(t), [
		{ ...header, version: 1 },
		{ type: "message", message: { role: "user", content: "Legacy prompt" } },
		{ type: "message", message: { role: "assistant", content: [{ type: "text", text: "Legacy answer" }], stopReason: "stop" } },
	]);
	const original = readFileSync(file, "utf8");
	assert.deepEqual(lastReplies(file, 1), ["Legacy answer"]);
	assert.equal(readFileSync(file, "utf8"), original);
});

test("malformed cyclic session history fails instead of hanging Pi", (t) => {
	const file = sessionFile(sandbox(t), [header, message("loop", "loop", "user", "Cycle")]);
	assert.throws(() => lastReplies(file, 1), /Cyclic session history/);
});

test("current prompt snapshots preserve empty pending and failed requests instead of falling back", (t) => {
	const dir = sandbox(t);
	const entries = [header, message("u1", null, "user", "Old request"), assistant("a1", "u1", "OLD REPORT"),
		message("u2", "a1", "user", "Current request")];
	const file = sessionFile(dir, entries);
	assert.deepEqual(readPromptReplies(file).at(-1), { promptId: "u2", text: "", stopReason: undefined });
	assert.deepEqual(lastReplies(file, 1), ["OLD REPORT"], "explicit history stays available separately");
	sessionFile(dir, [...entries, assistant("a2", "u2", "", "error")]);
	assert.deepEqual(readPromptReplies(file).at(-1), { promptId: "u2", text: "", stopReason: "error" });
});

test("an empty final stop completes the report accumulated around tool calls", (t) => {
	const dir = sandbox(t);
	const entries = [header, message("u1", null, "user", "Request"), assistant("a1", "u1", "Report", "toolUse")];
	const file = sessionFile(dir, entries);
	assert.deepEqual(readPromptReplies(file).at(-1), { promptId: "u1", text: "Report", stopReason: "toolUse" });
	sessionFile(dir, [...entries, assistant("a2", "a1", "")]);
	assert.deepEqual(readPromptReplies(file).at(-1), { promptId: "u1", text: "Report", stopReason: "stop" });
});

test("prompt identities include only the active branch and survive non-message leaf entries", (t) => {
	const file = sessionFile(sandbox(t), [header, message("u1", null, "user", "Common request"), assistant("a1", "u1", "Common report"),
		message("abandoned", "a1", "user", "Abandoned request"), assistant("old", "abandoned", "Abandoned report"),
		message("u2", "a1", "user", "Current request"), assistant("a2", "u2", "Current report"),
		{ type: "session_info", id: "leaf", parentId: "a2", name: "Metadata" }]);
	assert.deepEqual(readPromptReplies(file).map((reply) => reply.promptId), ["u1", "u2"]);
});

test("legacy prompt identities are stable across repeated read-only migrations and appends", (t) => {
	const dir = sandbox(t);
	const entries = [{ ...header, version: 1 },
		{ type: "message", message: { role: "user", content: "Legacy prompt" } },
		{ type: "message", message: { role: "assistant", content: [{ type: "text", text: "Legacy answer" }], stopReason: "stop" } }];
	const file = sessionFile(dir, entries);
	const original = readFileSync(file, "utf8");
	const first = readPromptReplies(file);
	assert.deepEqual(readPromptReplies(file), first);
	assert.equal(readFileSync(file, "utf8"), original);
	sessionFile(dir, [...entries, { type: "message", message: { role: "user", content: "Next legacy prompt" } }]);
	assert.equal(readPromptReplies(file)[0].promptId, first[0].promptId);
	assert.notEqual(readPromptReplies(file)[1].promptId, first[0].promptId);
});
