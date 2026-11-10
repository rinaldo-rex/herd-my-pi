import type { Api, Model } from "@earendil-works/pi-ai";
import { type ExtensionContext, ModelSelectorComponent } from "@earendil-works/pi-coding-agent";
import { Container, matchesKey, Text, truncateToWidth } from "@earendil-works/pi-tui";
import type { AgentTemplate } from "./agents.ts";
import { clampThinking, levelsFor, resolveModel, runtimeOf, type ThinkingLevel } from "./models.ts";

/** An agent as it will be started: the template plus any model/thinking changed in the picker. */
export interface HerdChoice {
	agent: AgentTemplate;
	/** Unset: the sub-agent uses pi's default model. */
	model?: Model<Api>;
	/** Set when the template names a model that can't be used here. */
	modelError?: string;
	thinking?: ThinkingLevel;
}

type Field = "model" | "thinking";
type Action = { kind: "start" } | { kind: "cancel" } | { kind: "model"; index: number };

interface ListState {
	choices: HerdChoice[];
	checked: Set<number>;
	cursor: number;
	field?: Field;
	signal?: AbortSignal;
}

interface PickerOptions {
	recommended?: readonly string[];
	signal?: AbortSignal;
}

/** Close a custom UI once, and remove the abort listener on completion/disposal. */
function abortableDone<T>(signal: AbortSignal | undefined, done: (value: T) => void, cancelled: T) {
	let closed = false;
	const dispose = () => {
		closed = true;
		signal?.removeEventListener("abort", abort);
	};
	const finish = (value: T) => {
		if (closed) return;
		dispose();
		done(value);
	};
	const abort = () => finish(cancelled);
	signal?.addEventListener("abort", abort, { once: true });
	if (signal?.aborted) abort();
	return { finish, dispose };
}

export async function pickAgents(ctx: ExtensionContext, agents: AgentTemplate[], source: string, options: PickerOptions = {}): Promise<HerdChoice[]> {
	if (!agents.length || options.signal?.aborted) return [];
	const state: ListState = {
		choices: agents.map((agent) => {
			if (agent.thinking && !levelsFor().includes(agent.thinking as ThinkingLevel))
				throw new Error(`${agent.file}: invalid thinking level "${agent.thinking}"`);
			const { model, error, thinking: modelThinking } = agent.model ? resolveModel(ctx, agent.model) : {};
			const thinking = (agent.thinking as ThinkingLevel | undefined) ?? modelThinking;
			return { agent, model, modelError: error, thinking: model && thinking ? clampThinking(model, thinking) : thinking };
		}),
		checked: new Set(agents.flatMap((agent, i) => options.recommended?.includes(agent.name) ? [i] : [])),
		cursor: 0,
		signal: options.signal,
	};
	for (;;) {
		if (options.signal?.aborted) return [];
		const action = await showList(ctx, state, source);
		if (action.kind === "cancel") return [];
		if (action.kind === "start") return state.choices.filter((_, i) => state.checked.has(i));
		await chooseModel(ctx, state.choices[action.index], options.signal);
		state.field = "model";
	}
}

function showList(ctx: ExtensionContext, state: ListState, source: string): Promise<Action> {
	return ctx.ui.custom<Action>(
		(tui, theme, keybindings, done) => {
			const { finish, dispose } = abortableDone<Action>(state.signal, done, { kind: "cancel" });
			let problem: string | undefined;
			let cached: { width: number; lines: string[] } | undefined;
			const n = state.choices.length;

			const field = (text: string, on: boolean) => (on ? theme.bg("selectedBg", theme.fg("accent", ` ${text} `)) : text);

			const row = (c: HerdChoice, i: number) => {
				const here = i === state.cursor;
				const box = state.checked.has(i) ? theme.fg("success", "[x]") : theme.fg("dim", "[ ]");
				const name = here ? theme.fg("accent", theme.bold(c.agent.name)) : c.agent.name;
				const model = c.modelError
					? theme.fg("error", `[${c.agent.model} unavailable]`)
					: field(c.model?.id ?? "default model", here && state.field === "model");
				const thinking = field(c.thinking ?? "default", here && state.field === "thinking");
				const brain = theme.fg("muted", `${model}${theme.fg("dim", " · ")}${thinking}`);
				return `${here ? theme.fg("accent", "›") : " "} ${box} ${name}  ${brain}  ${theme.fg("dim", c.agent.description)}`;
			};

			return {
				render(width: number): string[] {
					if (cached?.width === width) return cached.lines;
					const lines = [
						theme.fg("accent", theme.bold("Start a herd")) + theme.fg("dim", `  from ${source}`),
						...state.choices.map(row),
						problem
							? theme.fg("error", problem)
							: theme.fg("dim", "↑↓ move · space toggle · a all · tab model · shift+tab thinking · enter start · esc cancel"),
					].map((l) => truncateToWidth(l, width));
					cached = { width, lines };
					return lines;
				},
				handleInput(data: string): void {
					const c = state.choices[state.cursor];
					problem = undefined;
					if (keybindings.matches(data, "tui.select.up")) {
						state.cursor = (state.cursor - 1 + n) % n;
						state.field = undefined;
					} else if (keybindings.matches(data, "tui.select.down")) {
						state.cursor = (state.cursor + 1) % n;
						state.field = undefined;
					} else if (data === " ") {
						state.checked.has(state.cursor) ? state.checked.delete(state.cursor) : state.checked.add(state.cursor);
					} else if (data === "a") {
						const all = state.checked.size === n;
						state.choices.forEach((_, i) => (all ? state.checked.delete(i) : state.checked.add(i)));
					} else if (matchesKey(data, "shift+tab")) {
						// Like pi's own shift+tab, through the levels this agent's model supports.
						const levels = levelsFor(c.model);
						c.thinking = levels[(levels.indexOf(c.thinking ?? levels[levels.length - 1]) + 1) % levels.length];
						state.field = "thinking";
					} else if (matchesKey(data, "tab")) {
						return finish({ kind: "model", index: state.cursor });
					} else if (keybindings.matches(data, "tui.select.confirm")) {
						const blocked = state.choices.filter((ch, i) => state.checked.has(i) && ch.modelError);
						if (!blocked.length) return finish({ kind: "start" });
						problem = `Unavailable model: ${blocked.map((b) => b.agent.name).join(", ")}. Tab to pick another, or untick.`;
					} else if (keybindings.matches(data, "tui.select.cancel")) {
						return finish({ kind: "cancel" });
					} else return;
					cached = undefined;
					tui.requestRender();
				},
				invalidate() {
					cached = undefined;
				},
				dispose,
			};
		},
		{ blocked: { kind: "question", message: "Pick agents for the herd" } },
	);
}

/** pi's own /model selector, for one agent. */
function chooseModel(ctx: ExtensionContext, choice: HerdChoice, signal?: AbortSignal): Promise<void> {
	return ctx.ui.custom<void>((tui, theme, _keybindings, done) => {
		const { finish, dispose } = abortableDone<void>(signal, done, undefined);
		const pick = (model: Model<Api>) => {
			choice.model = model;
			choice.modelError = undefined;
			if (choice.thinking) choice.thinking = clampThinking(model, choice.thinking);
			finish();
		};
		const selector = new ModelSelectorComponent(
			tui,
			choice.model,
			runtimeOf(ctx),
			ctx.scopedModels,
			pick,
			() => finish(),
			undefined,
		);
		const header = new Text(theme.fg("accent", theme.bold(`Model for ${choice.agent.name}`)), 1, 0);
		const view = new Container();
		view.addChild(header);
		view.addChild(selector);
		// The selector has a search input: forward focus so typing and IME land in it.
		Object.defineProperty(view, "focused", {
			get: () => selector.focused,
			set: (v: boolean) => { selector.focused = v; },
		});
		return Object.assign(view, {
			handleInput: (data: string) => selector.handleInput(data),
			dispose: () => { dispose(); selector.dispose(); },
		});
	}, { blocked: { kind: "question", message: `Pick a model for ${choice.agent.name}` } });
}
