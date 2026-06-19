import { google } from "@ai-sdk/google";
import { generateText, stepCountIs } from "ai";
import { z } from "zod";
import { command, parser } from "zod-opts";
import pkg from "../package.json";
import type { InferredOptions } from "./cli-utils";
import { tools } from "./tools";

const argSchema = {
	prompt: {
		type: z.string().describe("prompt"),
		alias: "p",
	},
	model: {
		type: z.string().describe("model").default("gemini-3.1-flash-lite"),
	},
};

type ArgType = InferredOptions<typeof argSchema>;

export async function chat(args: ArgType) {
	const res = await generateText({
		prompt: args.prompt,
		model: google(args.model),
	});

	console.log(res.text);
}

export async function agent(args: ArgType) {
	const res = await generateText({
		prompt: args.prompt,
		model: google(args.model),
		tools,
		stopWhen: stepCountIs(10),
		experimental_onToolCallStart({ toolCall }) {
			console.log(`${toolCall.toolName} ${JSON.stringify(toolCall.input)}`);
		},
	});

	console.log(res.text);
}

const chatCmd = command("chat")
	.description("single turn chat")
	.options(argSchema)
	.action(chat);

const agentCmd = command("agent")
	.description("tool loop agent")
	.options(argSchema)
	.action(agent);

if (import.meta.main) {
	parser()
		.version(pkg.version)
		.name(pkg.name)
		.subcommand(chatCmd)
		.subcommand(agentCmd)
		.parse();
}
