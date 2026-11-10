import type { Api, Model } from "@earendil-works/pi-ai";
import { clampThinkingLevel, getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import { type ExtensionContext, type ModelRuntime, resolveCliModel } from "@earendil-works/pi-coding-agent";

export type ThinkingLevel = NonNullable<ExtensionContext["thinkingLevel"]>;

const ALL_LEVELS: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

/**
 * Extensions get a ModelRegistry; pi's resolver and /model selector take the ModelRuntime
 * it wraps. These are the only runtime methods they call, each a registry pass-through.
 */
export function runtimeOf(ctx: ExtensionContext): ModelRuntime {
	const registry = ctx.modelRegistry;
	return {
		getModels: () => registry.getAll(),
		getAvailableSnapshot: () => registry.getAvailable(),
		getModel: (provider: string, id: string) => registry.find(provider, id),
		getError: () => registry.getError(),
		refresh: (options?: Parameters<typeof registry.refresh>[0]) => registry.refresh(options),
		hasConfiguredAuth: (provider: string) => registry.hasConfiguredAuth({ provider } as Model<Api>),
	} as unknown as ModelRuntime;
}

/** Resolves a template's model the way `pi --model <pattern>` will in the sub-agent. */
export function resolveModel(ctx: ExtensionContext, pattern: string): { model?: Model<Api>; thinking?: ThinkingLevel; error?: string } {
	const r = resolveCliModel({ cliModel: pattern, modelRuntime: runtimeOf(ctx) });
	return r.model ? { model: r.model, thinking: r.thinkingLevel } : { error: r.error ?? `Model "${pattern}" not found` };
}

/** The levels pi's own shift+tab cycles through for this model. */
export const levelsFor = (model?: Model<Api>): ThinkingLevel[] =>
	model ? (getSupportedThinkingLevels(model) as ThinkingLevel[]) : ALL_LEVELS;

export const clampThinking = (model: Model<Api>, level: ThinkingLevel): ThinkingLevel =>
	clampThinkingLevel(model, level) as ThinkingLevel;

export const modelRef = (m: Model<Api>) => `${m.provider}/${m.id}`;
