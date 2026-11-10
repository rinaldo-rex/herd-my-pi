import { readFileSync } from "node:fs";
import {
	buildSessionContext,
	migrateSessionEntries,
	parseSessionEntries,
	type SessionEntry,
} from "@earendil-works/pi-coding-agent";

/**
 * The last `count` finished assistant replies on a session file's current branch, oldest first.
 * Pure read: SessionManager.open would migrate and rewrite a live session's file.
 */
export function lastReplies(sessionFile: string, count: number): string[] {
	const entries = parseSessionEntries(readFileSync(sessionFile, "utf8"));
	migrateSessionEntries(entries);
	const body = entries.filter((e): e is SessionEntry => e.type !== "session");
	// No leaf is stored on disk; pi takes the last entry when it loads a session.
	const { messages } = buildSessionContext(body, body.at(-1)?.id);

	const replies: string[] = [];
	for (let i = messages.length - 1; i >= 0 && replies.length < count; i--) {
		const m = messages[i];
		// Tool-call turns usually carry no text; they're steps, not answers.
		if (m.role !== "assistant" || m.stopReason === "toolUse") continue;
		const text = m.content
			.filter((c) => c.type === "text")
			.map((c) => c.text)
			.join("")
			.trim();
		if (text) replies.unshift(text);
	}
	return replies;
}
