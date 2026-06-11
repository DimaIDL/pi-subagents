/**
 * Minimal subagents extension — entry point.
 *
 * Registers `subagent` + `agents_info` tools with three agents: scout, researcher, worker.
 * Supports single and parallel execution. Output is verbal only (no file handoff).
 */
import { loadConfig, buildToolToExtensionMap, logToFile } from "./src/config.js";
import { getAgents, setAgents, loadAgents, SUBAGENT_ALLOWLIST } from "./src/agents.js";
import subagentTool from "./src/tools/subagent-tool.js";
import { createAgentsInfoTool } from "./src/tools/agents-info-tool.js";

export default function (pi: import("@earendil-works/pi-coding-agent").ExtensionAPI) {
	const config = loadConfig();
	buildToolToExtensionMap(config);
	setAgents(loadAgents());

	if (SUBAGENT_ALLOWLIST) {
		setAgents(getAgents().filter((a) => SUBAGENT_ALLOWLIST!.includes(a.name)));
	}

	logToFile("Extension loaded", { config, agents: getAgents().map((a) => a.name) }, config.debugLog);

	// Register tools
	subagentTool(pi, config.maxConcurrency ?? 4);
	pi.registerTool(createAgentsInfoTool());
}
