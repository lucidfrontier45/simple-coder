import type { z } from "zod";

type RequiredKeys<T extends Record<string, { type: z.ZodTypeAny }>> = {
	[K in keyof T]-?: T[K]["type"] extends z.ZodOptional<// biome-ignore lint/suspicious/noExplicitAny: needed for Zod optional type matching
	any>
		? never
		: K;
}[keyof T];

type OptionalKeys<T extends Record<string, { type: z.ZodTypeAny }>> = {
	[K in keyof T]-?: T[K]["type"] extends z.ZodOptional<// biome-ignore lint/suspicious/noExplicitAny: needed for Zod optional type matching
	any>
		? K
		: never;
}[keyof T];

export type InferredOptions<T extends Record<string, { type: z.ZodTypeAny }>> =
	{
		[K in RequiredKeys<T>]: z.infer<T[K]["type"]>;
	} & {
		[K in OptionalKeys<T>]?: z.infer<T[K]["type"]>;
	} & {};
