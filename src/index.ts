import { z } from "zod";
import { command, parser } from "zod-opts";
import pkg from "../package.json";
import type { InferredOptions } from "./cli-utils";

const cmdArgSchema = {
	name: {
		type: z.string().describe("The name to greet"),
		alias: "n",
	},
};

type CmdArgType = InferredOptions<typeof cmdArgSchema>;

export function hello(args: CmdArgType) {
	const msg = `Hello, ${args.name}!`;
	console.log(msg);
}

const cmd = command("hello")
	.description("Greets the user")
	.options(cmdArgSchema)
	.action(hello);

parser().version(pkg.version).name(pkg.name).subcommand(cmd).parse();
