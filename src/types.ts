/**
 * All types and interfaces for the subagents extension.
 */

// ── Agent Types ──────────────────────────────────────────────────────────

export interface AgentConfig {
	name: string;
	description: string;
	tools: string[];
	model?: string;
	thinking: string;
	systemPrompt: string;
	filePath: string;
	/**
	 * If this agent has the `subagent` tool, restrict which agents it may spawn.
	 * Passed to the child pi process via `PI_SUBAGENT_ALLOWED` so the child's
	 * subagents extension filters its own registry before exposing it to the LLM.
	 */
	subagentAgents?: string[];
}

// ── Progress Types ───────────────────────────────────────────────────────

export interface ToolEvent {
	tool: string;
	args: string;
	/** Matches the producing tool_execution_start/update/end event. */
	toolCallId?: string;
	status: "running" | "done";
	children?: AgentResult[];
}

export interface AgentProgress {
	agent: string;
	status: "pending" | "running" | "completed" | "failed";
	task: string;
	recentTools: ToolEvent[];
	toolCount: number;
	tokens: number;
	durationMs: number;
	lastMessage: string;
	error?: string;
}

export interface AgentResult {
	agent: string;
	task: string;
	output: string;
	exitCode: number;
	progress: AgentProgress;
	model?: string;
	contextWindow?: number;
	usage: { input: number; output: number; cacheRead: number; cacheWrite: number; cost: number; turns: number };
}

export interface Details {
	results: AgentResult[];
}

// ── Config Types ─────────────────────────────────────────────────────────

export interface ToolExtensionDef {
	toolName: string;
	extensionPath: string;
	enabled?: boolean; // defaults to true
}

export interface ExtensionConfig {
	maxConcurrency?: number;
	debugLog?: boolean;
	toolExtensions?: ToolExtensionDef[];
}
