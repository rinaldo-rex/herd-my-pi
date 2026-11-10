import { existsSync, readFileSync } from "node:fs";
import {
	migrateSessionEntries,
	parseSessionEntries,
	type SessionEntry,
	type SessionMessageEntry,
} from "@earendil-works/pi-coding-agent";

export interface PromptReply {
	promptId: string;
	text: string;
	stopReason?: string;
}

/**
 * Every user prompt on the active branch, including unanswered prompts. Keep the latest
 * prompt even when empty: dropping it would make an old report look like the current result.
 *
 * Reads the file without touching it (SessionManager.open would migrate and rewrite a live
 * session), and walks the raw chain rather than the model's context, so compaction doesn't
 * hide old answers. No leaf is stored on disk: like pi, take the last entry. A /tree jump that
 * hasn't been followed by a new message isn't visible here.
 */
export function readPromptReplies(sessionFile: string): PromptReply[] {
	// pi creates the file on the first message; until then there's nothing to read.
	if (!existsSync(sessionFile)) return [];
	const entries = parseSessionEntries(readFileSync(sessionFile, "utf8"));
	// Legacy migration generates random entry IDs. Preserve stable file positions for those
	// prompts instead, so repeated read-only freshness checks report the same identity.
	const promptIds = new Map<SessionEntry, string>();
	entries.forEach((e, i) => {
		if (e.type === "message" && e.message.role === "user") promptIds.set(e, e.id ?? `legacy:${i}`);
	});
	migrateSessionEntries(entries);
	const byId = new Map<string, SessionEntry>();
	for (const e of entries) if (e.type !== "session") byId.set(e.id, e);

	const branch: SessionMessageEntry[] = [];
	const visited = new Set<string>();
	for (let e = [...byId.values()].at(-1); e; e = e.parentId ? byId.get(e.parentId) : undefined) {
		if (visited.has(e.id)) throw new Error(`Cyclic session history in ${sessionFile}`);
		visited.add(e.id);
		if (e.type === "message") branch.push(e as SessionMessageEntry);
	}
	branch.reverse();

	const turns: { promptId: string; texts: string[]; end?: string }[] = [];
	for (const entry of branch) {
		const m = entry.message;
		if (m.role === "user") turns.push({ promptId: promptIds.get(entry)!, texts: [] });
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

	return turns.map((t) => {
		const text = t.texts.join("\n\n");
		return {
			promptId: t.promptId,
			text: text && (t.end === "aborted" || t.end === "error") ? `(interrupted: ${t.end})\n\n${text}` : text,
			stopReason: t.end,
		};
	});
}

/** Explicit historical answers, oldest first; unanswered prompts do not displace history. */
export function lastReplies(sessionFile: string, count: number): string[] {
	return readPromptReplies(sessionFile).filter((reply) => reply.text).slice(-count).map((reply) => reply.text);
}
