import { google } from "@ai-sdk/google";
import { generateText, stepCountIs, ToolLoopAgent } from "ai";
import { z } from "zod";
import { command, parser } from "zod-opts";
import pkg from "../package.json";
import type { InferredOptions } from "./cli-utils";
import { tools } from "./tools";

const baseArgSchema = {
	prompt: {
		type: z.string().describe("prompt"),
		alias: "p",
	},
	model: {
		type: z.string().describe("model").default("gemini-3.1-flash-lite"),
	},
};

const agentArgSchema = {
	...baseArgSchema,
	maxSteps: {
		type: z.number().int().positive().default(20).describe("max steps"),
	},
};

type ArgType = InferredOptions<typeof baseArgSchema>;
type AgentArgType = InferredOptions<typeof agentArgSchema>;

export async function chat(args: ArgType) {
	const res = await generateText({
		prompt: args.prompt,
		model: google(args.model),
	});

	console.log(res.text);
}

export async function agent(args: AgentArgType) {
	const agent = new ToolLoopAgent({
		model: google(args.model),
		tools,
		stopWhen: stepCountIs(args.maxSteps),
		onStepFinish(step) {
			for (const toolCall of step.toolCalls) {
				console.log(`${toolCall.toolName} ${JSON.stringify(toolCall.input)}`);
			}
		},
	});

	const res = await agent.generate({
		prompt: args.prompt,
	});

	console.log(res.text);
}

const chatCmd = command("chat")
	.description("single turn chat")
	.options(baseArgSchema)
	.action(chat);

const agentCmd = command("agent")
	.description("tool loop agent")
	.options(agentArgSchema)
	.action(agent);

if (import.meta.main) {
	parser()
		.version(pkg.version)
		.name(pkg.name)
		.subcommand(chatCmd)
		.subcommand(agentCmd)
		.parse();
}
