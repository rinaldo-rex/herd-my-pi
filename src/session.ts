import { existsSync, readFileSync } from "node:fs";
import {
	migrateSessionEntries,
	parseSessionEntries,
	type SessionEntry,
	type SessionMessageEntry,
} from "@earendil-works/pi-coding-agent";

/**
 * The member's answers to its last `count` prompts, oldest first. An answer is all the text it
 * wrote in that turn: the result often shares a message with a tool call (e.g. `hc send … done`),
 * and a short note can follow it.
 *
 * Reads the file without touching it (SessionManager.open would migrate and rewrite a live
 * session), and walks the raw chain rather than the model's context, so compaction doesn't
 * hide old answers. No leaf is stored on disk: like pi, take the last entry. A /tree jump that
 * hasn't been followed by a new message isn't visible here.
 */
export function lastReplies(sessionFile: string, count: number): string[] {
	// pi creates the file on the first message; until then there's nothing to read.
	if (!existsSync(sessionFile)) return [];
	const entries = parseSessionEntries(readFileSync(sessionFile, "utf8"));
	migrateSessionEntries(entries);
	const byId = new Map<string, SessionEntry>();
	for (const e of entries) if (e.type !== "session") byId.set(e.id, e);

	const branch: SessionMessageEntry[] = [];
	for (let e = [...byId.values()].at(-1); e; e = e.parentId ? byId.get(e.parentId) : undefined)
		if (e.type === "message") branch.unshift(e as SessionMessageEntry);

	const turns: { texts: string[]; end?: string }[] = [];
	for (const { message: m } of branch) {
		if (m.role === "user") turns.push({ texts: [] });
		else if (m.role === "assistant" && turns.length) {
			const turn = turns[turns.length - 1];
			const text = m.content
				.filter((c) => c.type === "text")
				.map((c) => c.text)
				.join("")
				.trim();
			if (text) turn.texts.push(text);
			turn.end = m.stopReason;
		}
	}

	return turns
		.filter((t) => t.texts.length)
		.slice(-count)
		.map((t) => {
			const text = t.texts.join("\n\n");
			return t.end === "aborted" || t.end === "error" ? `(interrupted: ${t.end})\n\n${text}` : text;
		});
}
