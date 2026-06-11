/**
 * Agent discovery and registration.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";
import type { AgentConfig } from "./types.js";
import { AGENTS_DIR, logToFile } from "./config.js";

// ── Agent Registry ───────────────────────────────────────────────────────

let _agents: AgentConfig[] = [];

export function getAgents(): AgentConfig[] {
	return _agents;
}

export function setAgents(a: AgentConfig[]): void {
	_agents = a;
}

/** Read once at module load. If we're a child subagent process whose parent pinned an allowlist,
 *  we silently ignore any agent that isn't in the list. */
export const SUBAGENT_ALLOWLIST: string[] | undefined = (() => {
	const raw = process.env.PI_SUBAGENT_ALLOWED;
	if (!raw) return undefined;
	const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
	return list.length > 0 ? list : undefined;
})();

export function registerAgent(config: AgentConfig): void {
	if (SUBAGENT_ALLOWLIST && !SUBAGENT_ALLOWLIST.includes(config.name)) return;
	const list = getAgents();
	if (list.find((a) => a.name === config.name)) {
		throw new Error(`Agent already registered: ${config.name}`);
	}
	setAgents([...list, config]);
}

export function unregisterAgent(name: string): void {
	setAgents(getAgents().filter((a) => a.name !== name));
}

// Expose registration functions globally so other extensions loaded via jiti
// (which creates separate module instances) can access the shared agents array.
(globalThis as any).__pi_subagents = { registerAgent, unregisterAgent };

/** Load all agent definitions from .md files in AGENTS_DIR. */
export function loadAgents(): AgentConfig[] {
	const loaded: AgentConfig[] = [];
	if (!fs.existsSync(AGENTS_DIR)) return loaded;

	for (const entry of fs.readdirSync(AGENTS_DIR)) {
		if (!entry.endsWith(".md")) continue;
		try {
			const filePath = path.join(AGENTS_DIR, entry);
			const content = fs.readFileSync(filePath, "utf-8");
			const { frontmatter, body } = parseFrontmatter<Record<string, string>>(content);
			if (!frontmatter.name) continue;

			const tools = (frontmatter.tools || "")
				.split(",")
				.map((t) => t.trim())
				.filter(Boolean);
			const rawSubagentAgents = (frontmatter as Record<string, string>).subagent_agents;
			const subagentAgents = rawSubagentAgents
				? rawSubagentAgents.split(",").map((t) => t.trim()).filter(Boolean)
				: undefined;

			loaded.push({
				name: frontmatter.name,
				description: frontmatter.description || "",
				tools,
				model: frontmatter.model,
				thinking: frontmatter.thinking || "medium",
				systemPrompt: body,
				filePath,
				subagentAgents,
			});

			logToFile(`Agent loaded: ${frontmatter.name}`, { agent: frontmatter.name, tools, model: frontmatter.model });
		} catch (e) {
			const errMsg = e instanceof Error ? e.message : String(e);
			logToFile(`Failed to load agent file`, { error: errMsg, entry });
		}
	}

	return loaded;
}
