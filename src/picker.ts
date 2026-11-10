import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import type { AgentTemplate } from "./agents.ts";

/** Space toggles, enter starts the checked agents, esc cancels (resolves to []). */
export function pickAgents(ctx: ExtensionContext, agents: AgentTemplate[], source: string): Promise<AgentTemplate[]> {
	return ctx.ui.custom<AgentTemplate[]>(
		(tui, theme, keybindings, done) => {
			const checked = new Set<number>();
			let cursor = 0;
			let cached: { width: number; lines: string[] } | undefined;

			const row = (a: AgentTemplate, i: number) => {
				const here = i === cursor;
				const box = checked.has(i) ? theme.fg("success", "[x]") : theme.fg("dim", "[ ]");
				const name = here ? theme.fg("accent", theme.bold(a.name)) : a.name;
				const brain = [a.model?.split("/").pop(), a.thinking].filter(Boolean).join(" · ");
				const meta = [brain, a.description].filter(Boolean).join("  ");
				return `${here ? theme.fg("accent", "›") : " "} ${box} ${name}  ${theme.fg("muted", meta)}`;
			};

			return {
				render(width: number): string[] {
					if (cached?.width === width) return cached.lines;
					const lines = [
						theme.fg("accent", theme.bold("Start a herd")) + theme.fg("dim", `  from ${source}`),
						...agents.map(row),
						theme.fg("dim", "↑↓ move · space toggle · a all · enter start · esc cancel"),
					].map((l) => truncateToWidth(l, width));
					cached = { width, lines };
					return lines;
				},
				handleInput(data: string): void {
					if (keybindings.matches(data, "tui.select.up")) cursor = (cursor - 1 + agents.length) % agents.length;
					else if (keybindings.matches(data, "tui.select.down")) cursor = (cursor + 1) % agents.length;
					else if (data === " ") checked.has(cursor) ? checked.delete(cursor) : checked.add(cursor);
					else if (data === "a") {
						const all = checked.size === agents.length;
						agents.forEach((_, i) => (all ? checked.delete(i) : checked.add(i)));
					} else if (keybindings.matches(data, "tui.select.confirm")) return done(agents.filter((_, i) => checked.has(i)));
					else if (keybindings.matches(data, "tui.select.cancel")) return done([]);
					else return;
					cached = undefined;
					tui.requestRender();
				},
				invalidate() {
					cached = undefined;
				},
			};
		},
		{ blocked: { kind: "question", message: "Pick agents for the herd" } },
	);
}
