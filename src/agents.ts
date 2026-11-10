import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";

export interface AgentTemplate {
	name: string;
	description: string;
	model?: string;
	thinking?: string;
	/** Appended to the sub-agent's system prompt. */
	prompt: string;
	file: string;
}

/** Where a project keeps its own (editable, shareable) agents. */
export const PROJECT_AGENTS_DIR = join(".pi", "extensions", "herd-my-pi", "agents");

/** Agents shipped with the package, wherever it is installed. */
export const SHIPPED_AGENTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "agents");

const markdown = (dir: string) =>
	existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md")).sort() : [];

export function loadAgents(dir: string): AgentTemplate[] {
	return markdown(dir).map((f) => {
		const file = join(dir, f);
		const { frontmatter, body } = parseFrontmatter<Record<string, unknown>>(readFileSync(file, "utf8"));
		const str = (v: unknown) => (v == null || v === "" ? undefined : String(v));
		return {
			name: str(frontmatter.name) ?? basename(f, ".md"),
			description: str(frontmatter.description) ?? "",
			model: str(frontmatter.model),
			thinking: str(frontmatter.thinking),
			prompt: body.trim(),
			file,
		};
	});
}

/** Copies shipped agents into the project, never overwriting. Returns how many were copied. */
export function copyShippedAgents(projectDir: string): number {
	mkdirSync(projectDir, { recursive: true });
	let copied = 0;
	for (const f of markdown(SHIPPED_AGENTS_DIR)) {
		const target = join(projectDir, f);
		if (existsSync(target)) continue;
		copyFileSync(join(SHIPPED_AGENTS_DIR, f), target);
		copied++;
	}
	return copied;
}
