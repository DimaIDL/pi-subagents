/**
 * Configuration, paths, tool extensions loading, and logging utilities.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionConfig } from "./types.js";

// ── Paths ────────────────────────────────────────────────────────────────

const EXT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const AGENTS_DIR = path.join(EXT_DIR, "..", "agents");
export const TOOLS_DIR = path.join(EXT_DIR, "..", "tools");
export const CONFIG_PATH = path.join(EXT_DIR, "..", "config.json");
export const LOGS_DIR = path.join(EXT_DIR, "..", "_logs");
export const DEFAULT_MAX_CONCURRENCY = 4;

// ── Home Directory Resolution ────────────────────────────────────────────

/** Expand `~` to the user's home directory (cross-platform). */
export function resolveHomeDir(filePath: string): string {
	if (!filePath.startsWith("~/")) return filePath;
	return path.join(os.homedir(), filePath.slice(2));
}

// ── Tool Extensions Loader ───────────────────────────────────────────────

/** Static tools always available (built into this extension). */
const STATIC_TOOL_TO_EXTENSION: Record<string, string> = {
	safe_bash: path.join(TOOLS_DIR, "safe-bash.ts"),
	subagent: path.join(EXT_DIR, "..", "index.ts"),
};

let TOOL_TO_EXTENSION: Record<string, string>;

/** Load tool→extension mappings from config and merge with static ones. */
export function loadToolExtensions(config: ExtensionConfig): Record<string, string> {
	const list = config.toolExtensions ?? [];
	return list.filter((t) => t.enabled !== false).reduce(
		(acc, t) => { acc[t.toolName] = resolveHomeDir(t.extensionPath); return acc; },
		{} as Record<string, string>,
	);
}

/** Final merged map: static + dynamic tool→extension mappings. */
export function buildToolToExtensionMap(config: ExtensionConfig): void {
	TOOL_TO_EXTENSION = { ...STATIC_TOOL_TO_EXTENSION, ...loadToolExtensions(config) };
}

/** Get the final merged map (read-only). */
export function getToolToExtension(): Record<string, string> {
	return TOOL_TO_EXTENSION;
}

// ── Logging ──────────────────────────────────────────────────────────────

/** Append a structured log entry to the per-day file. Creates the file if it doesn't exist. */
export function logToFile(message: string, metadata?: Record<string, unknown>, debugLog?: boolean): void {
	const enabled = debugLog !== undefined ? debugLog : true;
	if (!enabled) return;
	try {
		if (!fs.existsSync(LOGS_DIR)) {
			fs.mkdirSync(LOGS_DIR, { recursive: true });
		}
		const now = new Date();
		const filename = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}.txt`;
		const filepath = path.join(LOGS_DIR, filename);
		const entry: { message: string; timestamp: string; metadata?: Record<string, unknown> } = {
			message,
			timestamp: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`,
		};
		if (metadata) {
			entry.metadata = metadata;
		}
		fs.appendFileSync(filepath, JSON.stringify(entry, null, 2) + "\n", { encoding: "utf-8" });
	} catch (e) {
		console.error(`logToFile failed: ${e instanceof Error ? e.message : e}`);
	}
}

// ── Config Loader ────────────────────────────────────────────────────────

export function loadConfig(): ExtensionConfig {
	try {
		if (fs.existsSync(CONFIG_PATH)) {
			return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as ExtensionConfig;
		}
	} catch {}
	return {};
}

// ── Built-in Tools ───────────────────────────────────────────────────────

export const BUILTIN_TOOLS = new Set(["read", "write", "edit", "bash", "grep", "find", "ls"]);
