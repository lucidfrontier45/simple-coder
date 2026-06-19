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
	description: "Read a file from a line range.",
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
		return lines.slice(from - 1, to).join("\n");
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

export const tools = {
	read: readTool,
	glob: globTool,
	grep: grepTool,
};
