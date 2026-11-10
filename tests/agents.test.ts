import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { copyShippedAgents, loadAgents, SHIPPED_AGENTS_DIR } from "../src/agents.ts";
import { sandbox } from "./helpers.ts";

test("loadAgents handles absent directories and sorted Markdown frontmatter", (t) => {
	const dir = sandbox(t);
	assert.deepEqual(loadAgents(join(dir, "missing")), []);
	writeFileSync(join(dir, "z.md"), "Body without metadata\n");
	writeFileSync(join(dir, "a.md"), '\ufeff---\r\nname: Scout\r\ndescription: "Find code"\r\nmodel: test/model:high\r\nthinking: low\r\n---\r\n\r\n  Prompt body  \r\n');
	writeFileSync(join(dir, "ignored.txt"), "Not an agent");
	const agents = loadAgents(dir);
	assert.deepEqual(agents.map((agent) => agent.name), ["Scout", "z"]);
	assert.equal(agents[0].description, "Find code");
	assert.equal(agents[0].model, "test/model:high");
	assert.equal(agents[0].thinking, "low");
	assert.equal(agents[0].prompt, "Prompt body");
	assert.equal(agents[1].description, "");
	assert.equal(agents[1].model, undefined);
});

test("copyShippedAgents never replaces project edits and is idempotent", (t) => {
	const dir = join(sandbox(t), "nested", "agents");
	mkdirSync(dir, { recursive: true });
	const files = readdirSync(SHIPPED_AGENTS_DIR).filter((file) => file.endsWith(".md"));
	writeFileSync(join(dir, files[0]), "Project customizations\n");
	assert.equal(copyShippedAgents(dir), files.length - 1);
	assert.equal(readFileSync(join(dir, files[0]), "utf8"), "Project customizations\n");
	assert.equal(copyShippedAgents(dir), 0);
	assert.equal(loadAgents(dir).length, files.length);
});

test("shipped templates have unique names and inherit the user's model", () => {
	const agents = loadAgents(SHIPPED_AGENTS_DIR);
	assert.ok(agents.length >= 3);
	assert.equal(new Set(agents.map((agent) => agent.name)).size, agents.length);
	for (const agent of agents) {
		assert.equal(agent.model, undefined);
		assert.ok(agent.prompt);
		assert.ok(agent.description);
	}
});
