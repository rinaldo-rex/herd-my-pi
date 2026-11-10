import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionContext, KeybindingsManager, Theme } from "@earendil-works/pi-coding-agent";
import { initTheme, ModelSelectorComponent } from "@earendil-works/pi-coding-agent";
import { type Component, type TUI, visibleWidth } from "@earendil-works/pi-tui";
import type { AgentTemplate } from "../src/agents.ts";
import { clampThinking, levelsFor, modelRef, resolveModel, runtimeOf } from "../src/models.ts";
import { pickAgents } from "../src/picker.ts";
import { context, model } from "./helpers.ts";

type View = Component & { focused?: boolean; dispose?(): void; children?: Component[] };
const agent = (extra: Partial<AgentTemplate> = {}): AgentTemplate => ({ name: "scout", description: "Explore", prompt: "Read only", file: "/test/scout.md", ...extra });

/** Drive actual components without a terminal, provider request, or Pi process. */
function drive(ctx: ExtensionContext, stages: ((view: View) => void)[]): void {
	ctx.ui.custom = async function<T>(factory: (tui: TUI, theme: Theme, keybindings: KeybindingsManager, done: (result: T) => void) => View | Promise<View>): Promise<T> {
		const { promise, resolve } = Promise.withResolvers<T>();
		const tui = { requestRender() {} } as unknown as TUI;
		const theme = { fg: (_color: string, text: string) => text, bg: (_color: string, text: string) => text, bold: (text: string) => text } as unknown as Theme;
		const keys: Record<string, string> = { "tui.select.up": "up", "tui.select.down": "down", "tui.select.confirm": "enter", "tui.select.cancel": "cancel" };
		const keybindings = { matches: (data: string, key: string) => data === keys[key] } as unknown as KeybindingsManager;
		const view = await factory(tui, theme, keybindings, resolve);
		const stage = stages.shift();
		assert.ok(stage, "unexpected custom UI");
		try { stage(view); } finally { view.dispose?.(); }
		return promise;
	};
}

const press = (view: View, ...keys: string[]) => keys.forEach((key) => view.handleInput?.(key));

test("resolves model suffix thinking and forwards the registry runtime methods", async () => {
	const ctx = context();
	assert.deepEqual(resolveModel(ctx, "test-provider/test-model:high"), { model, thinking: "high" });
	assert.ok(resolveModel(ctx, "no-such-provider/no-model").error);
	assert.equal(modelRef(model), "test-provider/test-model");
	const runtime = runtimeOf(ctx);
	assert.deepEqual(runtime.getModels(), [model]);
	assert.deepEqual(runtime.getAvailableSnapshot(), [model]);
	assert.equal(runtime.getModel(model.provider, model.id), model);
	assert.equal(runtime.hasConfiguredAuth(model.provider), true);
	assert.equal(runtime.getError(), undefined);
	assert.equal((await runtime.refresh()).aborted, false);
});

test("empty picker never opens UI; invalid template thinking is rejected", async () => {
	const ctx = context();
	assert.deepEqual(await pickAgents(ctx, [], "empty"), []);
	await assert.rejects(pickAgents(ctx, [agent({ thinking: "banana" })], "test"), /scout.md: invalid thinking level "banana"/);
});

test("model thinking suffix survives selection and explicit thinking takes precedence", async () => {
	const ctx = context();
	drive(ctx, [(view) => press(view, "a", "enter")]);
	const choices = await pickAgents(ctx, [agent({ model: "test-model:high" }), agent({ model: "test-model:high", thinking: "low" })], "test");
	assert.deepEqual(choices.map((choice) => choice.thinking), ["high", "low"]);
});

test("thinking is clamped for nonreasoning models and cycles only supported values", async () => {
	const plain = { ...model, reasoning: false };
	const ctx = context([plain]);
	assert.deepEqual(levelsFor(plain), ["off"]);
	assert.equal(clampThinking(plain, "max"), "off");
	drive(ctx, [(view) => press(view, " ", "\u001b[Z", "enter")]);
	const [choice] = await pickAgents(ctx, [agent({ model: "test-model", thinking: "max" })], "test");
	assert.equal(choice.thinking, "off");
});

test("picker toggles all, navigates, cancels, and keeps rendering within narrow widths", async () => {
	const ctx = context();
	drive(ctx, [(view) => {
		press(view, "a", "a", "down", " ", "up");
		for (const width of [1, 12, 80]) {
			assert.ok(view.render(width).every((line) => visibleWidth(line) <= width));
			view.invalidate();
		}
		press(view, "enter");
	}]);
	const choices = await pickAgents(ctx, [agent(), agent({ name: "other" })], "test");
	assert.deepEqual(choices.map((choice) => choice.agent.name), ["other"]);
	drive(ctx, [(view) => press(view, " ", "cancel")]);
	assert.deepEqual(await pickAgents(ctx, [agent()], "test"), []);
});

test("recommendations are preselected but only the user's final selection is returned", async () => {
	const ctx = context();
	drive(ctx, [(view) => {
		assert.match(view.render(240).join("\n"), /\[x\] scout/);
		assert.match(view.render(240).join("\n"), /\[ \] other/);
		press(view, " ", "down", " ", "enter");
	}]);
	const choices = await pickAgents(ctx, [agent(), agent({ name: "other" })], "test", { recommended: ["scout"] });
	assert.deepEqual(choices.map((choice) => choice.agent.name), ["other"]);
});

test("abort closes both the herd picker and nested model selector without a selection", async () => {
	initTheme("dark", false);
	for (const nested of [false, true]) {
		const ctx = context();
		const controller = new AbortController();
		const stages = nested
			? [(view: View) => press(view, "\t"), () => controller.abort()]
			: [() => controller.abort()];
		drive(ctx, stages);
		assert.deepEqual(await pickAgents(ctx, [agent()], "test", { recommended: ["scout"], signal: controller.signal }), []);
	}
	const ctx = context();
	drive(ctx, []);
	assert.deepEqual(await pickAgents(ctx, [agent()], "test", { signal: AbortSignal.abort() }), []);
});

test("unresolved models cannot start until unchecked", async () => {
	const ctx = context([]);
	drive(ctx, [(view) => {
		press(view, " ", "enter");
		assert.match(view.render(160).join("\n"), /Unavailable model: scout/);
		press(view, " ", "enter");
	}]);
	assert.deepEqual(await pickAgents(ctx, [agent({ model: "missing" })], "test"), []);
});

test("nested model selector forwards focus to its search input and preserves selection", async () => {
	initTheme("dark", false);
	const ctx = context();
	drive(ctx, [
		(view) => press(view, " ", "\t"),
		(view) => {
			const selector = view.children?.find((child) => child instanceof ModelSelectorComponent) as ModelSelectorComponent;
			assert.ok(selector);
			view.focused = true;
			assert.equal(selector.focused, true, "wrapper focus must reach the selector (Object.assign loses accessors)");
			view.focused = false;
			assert.equal(selector.focused, false);
			press(view, "\r");
		},
		(view) => press(view, "enter"),
	]);
	const [choice] = await pickAgents(ctx, [agent({ thinking: "max" })], "test");
	assert.equal(choice.model, model);
	assert.equal(choice.thinking, clampThinking(model, "max"));
});
