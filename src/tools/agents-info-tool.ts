/**
 * Agents info tool — list all registered agents with their metadata.
 */
import { Container, Spacer, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import type { AgentConfig } from "../types.js";
import { getAgents } from "../agents.js";

export default function (): void {
	// This tool doesn't need registration via pi.registerTool — it's called directly.
	// But we still export a factory that returns the tool definition for index.ts to use.
}

/** Create the agents_info tool definition for pi.registerTool(). */
export function createAgentsInfoTool(): any {
	return {
		name: "agents_info",
		label: "Agents Info",
		description: "List all registered agents with their metadata (model, tools, thinking level).",
		parameters: Type.Object({
			agent: Type.Optional(Type.String({ description: "Optional agent name to filter by" })),
		}),

		async execute(toolCallId: string, params: { agent?: string }, signal: AbortSignal | undefined, onUpdate: ((progress: any) => void) | undefined, ctx: any) {
			const filtered = getAgents().filter((a) => !params.agent || a.name === params.agent);
			return {
				content: [{ type: "text", text: JSON.stringify(filtered.map((a) => ({
					name: a.name,
					description: a.description,
					model: a.model,
					thinking: a.thinking,
					tools: a.tools,
					filePath: a.filePath,
				})), null, 2) }],
				details: { agents: filtered },
			};
		},

		renderCall(args: any, theme: any, context: any) {
			if (!context.expanded) {
				const filter = args.agent ? ` [${args.agent}]` : "";
				return new Text(
					`${theme.fg("toolTitle", theme.bold("agents_info"))}${filter}`,
					0, 0,
				);
			}

			const c = context.lastComponent instanceof Container
				? (context.lastComponent.clear(), context.lastComponent)
				: new Container();
			c.addChild(new Text(`${theme.fg("toolTitle", theme.bold("agents_info"))}`, 0, 0));
			if (args.agent) {
				c.addChild(new Spacer(1));
				c.addChild(new Text(theme.fg("text", `Filter: ${args.agent}`), 0, 0));
			}
			return c;
		},

		renderResult(result: any, options: any, theme: any, context: any) {
			const details = result.details as { agents?: AgentConfig[] } | undefined;
			if (!details?.agents?.length) {
				return new Text("No agents found", 0, 0);
			}

			const w = options.termWidth || 120;
			const expanded = options.expanded;
			const c = new Container();

			for (const agent of details.agents) {
				c.addChild(new Text(
					`${theme.fg("toolTitle", theme.bold(agent.name))}`,
					0, 0,
				));
				if (agent.description) {
					c.addChild(new Text(
						`${theme.fg("dim", agent.description.slice(0, 80))}`,
						0, 0,
					));
				}
				const meta = [
					agent.model ? `model: ${agent.model}` : "",
					`thinking: ${agent.thinking}`,
					`tools: [${agent.tools.join(", ")}]`,
				].filter(Boolean).join(" | ");
				c.addChild(new Text(theme.fg("dim", meta), 0, 0));
				if (expanded) {
					c.addChild(new Spacer(1));
				}
			}

			return c;
		},
	};
}
