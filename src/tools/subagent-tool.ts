/**
 * Subagent tool definition — execute + renderCall + renderResult.
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, Spacer, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import type { AgentResult, Details } from "../types.js";
import { getAgents } from "../agents.js";
import { runSubagent, Semaphore } from "../execution.js";
import { renderAgentProgress, getTermWidth } from "../rendering.js";

export default function (pi: ExtensionAPI, maxConcurrency?: number): void {
	const semaphore = new Semaphore(maxConcurrency ?? 4);

	pi.registerTool({
		name: "subagent",
		label: "Subagent",
		description: "Run a subagent to complete a task.",
		promptSnippet: "Run subagents for delegated tasks",
		promptGuidelines: [
			"Parallel tool calls are your primary parallelism mechanism — put multiple independent read/fetch/search calls in one function_calls block. Don't use subagents to parallelize simple I/O.",
			"Use subagent to delegate *reasoning and decisions*: codebase exploration (scout), web research (researcher), or isolated code changes (worker)",
			"For multiple independent subagent tasks, emit multiple `subagent` tool calls in the same turn — they run in parallel automatically.",
			"Subagents have NO context from the current conversation — include ALL necessary context in the task description",
		],
		parameters: Type.Object({
			agent: Type.String({ description: "Name of the agent to invoke" }),
			task: Type.String({ description: "Task description" }),
			cwd: Type.Optional(Type.String({ description: "Working directory for the agent process" })),
			model: Type.Optional(Type.String({ description: "Optional model override in provider/model-id format (e.g. 'openai/gpt-4o')" })),
		}),

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const cwd = ctx.cwd;

			if (!params.agent || !params.task) {
				throw new Error("`subagent` requires both `agent` and `task`. To fan out work, emit multiple `subagent` tool calls in the same turn — they run in parallel.");
			}

			const agentRef = getAgents().find((a) => a.name === params.agent);
			if (!agentRef) {
				const available = getAgents().map((a) => a.name).join(", ") || "none";
				throw new Error(`Unknown agent: ${params.agent}. Available agents: ${available}`);
			}

			// Clone the agent config — we modify model locally without touching the registry.
			const agent = { ...agentRef };

			// Priority chain for model selection:
			// 1. Explicitly passed by LLM via tool param (params.model)
			// 2. Declared in agent config from YAML frontmatter (agent.model)
			// 3. Current parent process model (ctx.model)
			if (!agent.model && params.model) {
				agent.model = params.model;
			} else if (!agent.model && ctx.model) {
				agent.model = `${(ctx as ExtensionContext).model?.provider}/${(ctx as ExtensionContext).model?.id}`;
			}

			const [provider, modelId] = (agent.model || "").split("/");
			const contextWindow = provider && modelId ? (ctx as ExtensionContext).modelRegistry.find(provider, modelId)?.contextWindow : undefined;

			const liveResult: AgentResult = {
				agent: params.agent,
				task: params.task,
				output: "",
				exitCode: -1,
				model: agent.model,
				contextWindow,
				usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 0 },
				progress: {
					agent: params.agent,
					status: "running" as const,
					task: params.task,
					recentTools: [],
					toolCount: 0,
					tokens: 0,
					durationMs: 0,
					lastMessage: "",
				},
			};

			const result = await semaphore.run(() =>
				runSubagent(agent, params.task!, params.cwd ?? cwd, signal, (progress, usage) => {
					liveResult.progress = progress;
					onUpdate?.({
						content: [{ type: "text", text: "(running...)" }],
						details: { results: [liveResult as any] },
					});
				}),
			);

			result.contextWindow = contextWindow;
			const isError = result.exitCode !== 0 || !!result.progress.error;
			return {
				content: [{ type: "text", text: result.output || "(no output)" }],
				details: { results: [result] },
				...(isError ? { isError: true } : {}),
			};
		},

		renderCall(args, theme, context) {
			if (!context.expanded) {
				if (!args.agent) {
					return new Text(theme.fg("toolTitle", theme.bold("subagent")), 0, 0);
				}
				const taskPreview = args.task
					? (args.task.length > 60 ? args.task.slice(0, 60) + "…" : args.task).replace(/\n/g, " ")
					: "";
				return new Text(
					`${theme.fg("toolTitle", theme.bold("subagent"))} ${theme.fg("accent", args.agent)} ${theme.fg("dim", taskPreview)}`,
					0, 0,
				);
			}

			const c = context.lastComponent instanceof Container
				? (context.lastComponent.clear(), context.lastComponent)
				: new Container();
			const agentLabel = args.agent ? ` ${theme.fg("accent", args.agent)}` : "";
			const cwdLabel = args.cwd ? theme.fg("dim", ` (cwd: ${args.cwd})`) : "";
			c.addChild(new Text(`${theme.fg("toolTitle", theme.bold("subagent"))}${agentLabel}${cwdLabel}`, 0, 0));
			if (args.task) {
				c.addChild(new Spacer(1));
				c.addChild(new Text(theme.fg("text", args.task), 0, 0));
			}
			return c;
		},

		renderResult(result: any, options: any, theme: any, context: any) {
			const details = result.details as Details | undefined;
			if (!details?.results?.length) {
				const t = result.content[0];
				const text = t?.type === "text" ? t.text : "(no output)";
				return new Text(text.slice(0, 200), 0, 0);
			}

			const w = getTermWidth() - 4;
			const expanded = options.expanded;
			const c = new Container();
			c.addChild(renderAgentProgress(details.results[0], theme, expanded, w));
			return c;
		},
	});
}
