import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { z } from "zod";
import { command, parser } from "zod-opts";
import pkg from "../package.json";
import type { InferredOptions } from "./cli-utils";

const cmdArgSchema = {
	prompt: {
		type: z.string().describe("prompt"),
		alias: "p",
	},
	model: {
		type: z.string().describe("model").default("gemini-3.1-flash-lite"),
	},
};

type CmdArgType = InferredOptions<typeof cmdArgSchema>;

export function hello(name: string) {
	return `Hello, ${name}!`;
}

export async function chat(args: CmdArgType) {
	const res = await generateText({
		prompt: args.prompt,
		model: google(args.model),
	});

	console.log(res.text);
}

const cmd = command("chat")
	.description("single turn chat")
	.options(cmdArgSchema)
	.action(chat);

if (import.meta.main) {
	parser().version(pkg.version).name(pkg.name).subcommand(cmd).parse();
}
