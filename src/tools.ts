import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { tool } from "ai";
import { z } from "zod";

async function runCommand(command: string, args: string[]) {
	const proc = Bun.spawn([command, ...args], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);

	if (exitCode !== 0) {
		const message = stderr.trim() || `${command} exited with code ${exitCode}`;
		throw new Error(message);
	}

	return stdout;
}

export const readTool = tool({
	description:
		"Read a file from a line range, returning contents with embedded line numbers.",
	inputSchema: z.object({
		path: z.string().describe("file path"),
		start: z.number().int().describe("starting line, 1-based"),
		end: z
			.number()
			.int()
			.describe("ending line, 1-based; use -1 for the full file"),
	}),
	execute: async ({ path, start, end }) => {
		const text = await Bun.file(path).text();
		const lines = text.split(/\r?\n/);
		const from = Math.max(1, start);
		const to = end === -1 ? lines.length : Math.max(from, end);
		return lines
			.slice(from - 1, to)
			.map((line, i) => `${from + i}: ${line}`)
			.join("\n");
	},
});

export const globTool = tool({
	description: "Find files using fd.",
	inputSchema: z.object({
		path: z.string().describe("directory to search"),
		pattern: z.string().describe("fd search pattern"),
	}),
	execute: async ({ path, pattern }) => {
		const output = await runCommand("fd", ["--type", "f", pattern, path]);
		return output
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);
	},
});

export const grepTool = tool({
	description: "Search files using rg.",
	inputSchema: z.object({
		path: z.string().describe("directory to search"),
		pattern: z.string().describe("rg search pattern"),
	}),
	execute: async ({ path, pattern }) => {
		try {
			const output = await runCommand("rg", [
				"--line-number",
				"--no-heading",
				pattern,
				path,
			]);
			return output
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter(Boolean);
		} catch (error) {
			if (error instanceof Error && error.message.includes("exit code 1")) {
				return [];
			}

			throw error;
		}
	},
});

export const editTool = tool({
	description:
		"Create or overwrite a file, or replace an exact string inside a file.",
	inputSchema: z.object({
		path: z.string().describe("file path"),
		oldString: z
			.string()
			.optional()
			.describe("text to replace; omit to create/overwrite the entire file"),
		newString: z.string().describe("new text content"),
		replaceAll: z
			.boolean()
			.default(false)
			.describe("replace all occurrences of oldString"),
	}),
	execute: async ({ path, oldString, newString, replaceAll }) => {
		if (oldString === undefined) {
			await mkdir(dirname(path), { recursive: true });
			const created = !(await Bun.file(path).exists());
			await Bun.write(path, newString);
			return {
				mode: "write" as const,
				path,
				bytes: newString.length,
				created,
			};
		}

		if (oldString === "") {
			throw new Error("oldString cannot be empty");
		}
		if (oldString === newString) {
			throw new Error("oldString and newString must differ");
		}
		if (!(await Bun.file(path).exists())) {
			throw new Error(`${path} does not exist`);
		}

		const text = await Bun.file(path).text();
		const matches = text.split(oldString).length - 1;
		if (matches === 0) {
			throw new Error(`oldString not found in ${path}`);
		}
		if (matches > 1 && !replaceAll) {
			throw new Error(
				`oldString matches ${matches} times; add more context or set replaceAll: true`,
			);
		}

		const updated = replaceAll
			? text.split(oldString).join(newString)
			: text.replace(oldString, newString);
		await Bun.write(path, updated);
		return {
			mode: "replace" as const,
			path,
			replacements: replaceAll ? matches : 1,
		};
	},
});

export const tools = {
	read: readTool,
	glob: globTool,
	grep: grepTool,
	edit: editTool,
};
