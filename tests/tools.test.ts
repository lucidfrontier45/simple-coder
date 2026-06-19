import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { editTool, readTool } from "../src/tools";

describe("readTool", () => {
	let dir: string;

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), "simple-coder-read-"));
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	test("embeds line numbers for the full file", async () => {
		const path = join(dir, "lines.txt");
		await writeFile(path, "alpha\nbeta\ngamma\n");

		const res = await readTool.execute({ path, start: 1, end: -1 });

		expect(res).toBe("1: alpha\n2: beta\n3: gamma\n4: ");
	});

	test("numbers reflect original positions for a sub-range", async () => {
		const path = join(dir, "sub.txt");
		await writeFile(path, "one\ntwo\nthree\nfour\nfive\n");

		const res = await readTool.execute({ path, start: 2, end: 4 });

		expect(res).toBe("2: two\n3: three\n4: four");
	});
});

describe("editTool", () => {
	let dir: string;

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), "simple-coder-edit-"));
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	test("write mode creates a new file", async () => {
		const path = join(dir, "new.txt");
		const res = await editTool.execute({
			path,
			newString: "hello world",
			replaceAll: false,
		});

		expect(res).toEqual({
			mode: "write",
			path,
			bytes: 11,
			created: true,
		});
		expect(await Bun.file(path).text()).toBe("hello world");
	});

	test("write mode overwrites an existing file", async () => {
		const path = join(dir, "existing.txt");
		await Bun.write(path, "old content");

		const res = await editTool.execute({
			path,
			newString: "new content",
			replaceAll: false,
		});

		expect(res).toEqual({
			mode: "write",
			path,
			bytes: 11,
			created: false,
		});
		expect(await Bun.file(path).text()).toBe("new content");
	});

	test("write mode auto-creates missing parent directories", async () => {
		const path = join(dir, "nested", "deep", "file.txt");
		await editTool.execute({
			path,
			newString: "nested",
			replaceAll: false,
		});

		expect(await Bun.file(path).text()).toBe("nested");
	});

	test("replace mode replaces a single occurrence", async () => {
		const path = join(dir, "single.txt");
		await Bun.write(path, "foo bar baz");

		const res = await editTool.execute({
			path,
			oldString: "bar",
			newString: "qux",
			replaceAll: false,
		});

		expect(res).toEqual({ mode: "replace", path, replacements: 1 });
		expect(await Bun.file(path).text()).toBe("foo qux baz");
	});

	test("replace mode with replaceAll replaces every occurrence", async () => {
		const path = join(dir, "many.txt");
		await Bun.write(path, "a b a b a");

		const res = await editTool.execute({
			path,
			oldString: "a",
			newString: "x",
			replaceAll: true,
		});

		expect(res).toEqual({ mode: "replace", path, replacements: 3 });
		expect(await Bun.file(path).text()).toBe("x b x b x");
	});

	test("replace mode throws when oldString is not found", async () => {
		const path = join(dir, "missing-match.txt");
		await Bun.write(path, "hello world");

		await expect(
			editTool.execute({
				path,
				oldString: "nope",
				newString: "yes",
				replaceAll: false,
			}),
		).rejects.toThrow(`oldString not found in ${path}`);
	});

	test("replace mode throws on multiple matches without replaceAll", async () => {
		const path = join(dir, "multi.txt");
		await Bun.write(path, "dup dup");

		await expect(
			editTool.execute({
				path,
				oldString: "dup",
				newString: "one",
				replaceAll: false,
			}),
		).rejects.toThrow("oldString matches 2 times");
	});

	test("replace mode throws when oldString equals newString", async () => {
		const path = join(dir, "noop.txt");
		await Bun.write(path, "same");

		await expect(
			editTool.execute({
				path,
				oldString: "same",
				newString: "same",
				replaceAll: false,
			}),
		).rejects.toThrow("oldString and newString must differ");
	});

	test("replace mode throws when the file does not exist", async () => {
		const path = join(dir, "ghost.txt");

		await expect(
			editTool.execute({
				path,
				oldString: "x",
				newString: "y",
				replaceAll: false,
			}),
		).rejects.toThrow(`${path} does not exist`);
	});
});
