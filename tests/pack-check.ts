import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "herd-pack-"));
try {
	const packed = JSON.parse(execFileSync("pnpm", ["pack", "--json", "--pack-destination", dir], {
		encoding: "utf8", timeout: 30_000,
	})) as { filename: string; files: { path: string }[] };
	assert.ok(existsSync(resolve(dir, packed.filename)), "pack must produce a real tarball");
	const files = new Set(packed.files.map((file) => file.path));
	const expected = [
		"package.json", "README.md", "LICENSE", "CHANGELOG.md", "CONTRIBUTING.md", "SECURITY.md",
		"extensions/herd.ts", "skills/herd-my-pi/SKILL.md",
		...readdirSync("src").filter((file) => file.endsWith(".ts")).map((file) => `src/${file}`),
		...readdirSync("agents").filter((file) => file.endsWith(".md")).map((file) => `agents/${file}`),
	];
	for (const file of expected) assert.ok(files.has(file), `tarball missing ${file}`);
	for (const file of files) {
		assert.ok(expected.includes(file), `unexpected tarball file: ${file}`);
		assert.ok(!/(^|\/)(\.pi|\.git|node_modules|tests)(\/|$)/.test(file), `private/dev file packed: ${file}`);
	}
	const manifest = JSON.parse(readFileSync("package.json", "utf8"));
	for (const entry of manifest.pi.extensions) assert.ok(files.has(entry.replace(/^\.\//, "")), `extension entry missing: ${entry}`);
	for (const entry of manifest.pi.skills) assert.ok([...files].some((file) => file.startsWith(`${entry.replace(/^\.\//, "")}/`)), `skill entry missing: ${entry}`);
	console.log(`Validated ${basename(packed.filename)}: ${files.size} expected runtime, template, skill, and documentation files; no private/dev artifacts.`);
} finally {
	rmSync(dir, { recursive: true, force: true });
}
