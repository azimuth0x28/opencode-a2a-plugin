/**
 * Dynamic Skill Discovery
 *
 * Discovers available commands and tools from OpenCode session API
 * to dynamically generate Agent Card skills
 */

import type { OpenCodeClient } from "./executor.js";
import type { Logger } from "./types.js";

/**
 * Discovered skill from OpenCode
 */
export interface DiscoveredSkill {
	id: string;
	name: string;
	description: string;
	tags?: string[];
}

/**
 * Discovery result containing all found skills
 */
export interface DiscoveryResult {
	commands: DiscoveredSkill[];
	tools: DiscoveredSkill[];
	pluginSkills: DiscoveredSkill[];
	all: DiscoveredSkill[];
}

/**
 * Default skills to use when discovery fails
 */
const DEFAULT_SKILLS: DiscoveredSkill[] = [
	{
		id: "code-assistance",
		name: "Code Assistance",
		description: "Help with coding tasks, debugging, and implementation",
		tags: ["code", "programming"],
	},
	{
		id: "code-review",
		name: "Code Review",
		description: "Review code for issues, best practices, and improvements",
		tags: ["review", "quality"],
	},
	{
		id: "refactoring",
		name: "Refactoring",
		description: "Refactor code for better maintainability and performance",
		tags: ["refactor", "cleanup"],
	},
	{
		id: "documentation",
		name: "Documentation",
		description: "Generate and update documentation",
		tags: ["docs", "readme"],
	},
	{
		id: "testing",
		name: "Testing",
		description: "Write and run tests",
		tags: ["test", "coverage"],
	},
];

/**
 * Discover skills from OpenCode session API
 *
 * @param client - OpenCode client instance
 * @param logger - Optional logger for debugging
 * @returns DiscoveryResult with all discovered skills
 */
export async function discoverSkills(
	client?: OpenCodeClient,
	logger?: Logger,
): Promise<DiscoveryResult> {
	const result: DiscoveryResult = {
		commands: [],
		tools: [],
		pluginSkills: [],
		all: [],
	};

	if (!client) {
		logger?.log({
			body: {
				service: "a2a-plugin",
				level: "warn",
				message: "No OpenCode client provided, using default skills",
				extra: {},
			},
		});
		result.all = [...DEFAULT_SKILLS];
		return result;
	}

	try {
		// Try to get commands from session API
		result.commands = await getCommands(client, logger);
	} catch (error) {
		logger?.log({
			body: {
				service: "a2a-plugin",
				level: "warn",
				message: "Failed to get commands from session API",
				extra: { error: error instanceof Error ? error.message : String(error) },
			},
		});
		result.commands = [];
	}

	try {
		// Try to get tools from session API
		result.tools = await getTools(client, logger);
	} catch (error) {
		logger?.log({
			body: {
				service: "a2a-plugin",
				level: "warn",
				message: "Failed to get tools from session API",
				extra: { error: error instanceof Error ? error.message : String(error) },
			},
		});
		result.tools = [];
	}

	try {
		// Try to get plugin skills from session API
		result.pluginSkills = await getPluginSkills(client, logger);
	} catch (error) {
		logger?.log({
			body: {
				service: "a2a-plugin",
				level: "warn",
				message: "Failed to get plugin skills from session API",
				extra: { error: error instanceof Error ? error.message : String(error) },
			},
		});
		result.pluginSkills = [];
	}

	// Combine all skills and deduplicate by ID
	result.all = deduplicateSkills([
		...result.commands,
		...result.tools,
		...result.pluginSkills,
	]);

	// If no skills discovered, use defaults
	if (result.all.length === 0) {
		logger?.log({
			body: {
				service: "a2a-plugin",
				level: "info",
				message: "No skills discovered from session API, using defaults",
				extra: {},
			},
		});
		result.all = [...DEFAULT_SKILLS];
	}

	logger?.log({
		body: {
			service: "a2a-plugin",
			level: "info",
			message: `Discovered ${result.all.length} skills`,
			extra: {
				commands: result.commands.length,
				tools: result.tools.length,
				pluginSkills: result.pluginSkills.length,
			},
		},
	});

	return result;
}

/**
 * Get commands from OpenCode session API
 * Note: This method may not exist in all versions - uses fallback
 */
async function getCommands(
	client: OpenCodeClient,
	logger?: Logger,
): Promise<DiscoveredSkill[]> {
	// Try to call session.getCommands if it exists
	const sessionAny = client.session as any;
	if (typeof sessionAny.getCommands === "function") {
		const result = await sessionAny.getCommands();
		if (result?.data?.commands) {
			return result.data.commands.map((cmd: any) => ({
				id: cmd.id || cmd.name?.toLowerCase().replace(/\s+/g, "-"),
				name: cmd.name || cmd.id,
				description: cmd.description || cmd.help || "",
				tags: cmd.tags || ["command"],
			}));
		}
	}

	// Fallback: Try to get commands via session messages
	try {
		// Try alternative method names that might exist
		const methodsToTry = ["listCommands", "getAvailableCommands", "commands"];
		for (const method of methodsToTry) {
			if (typeof sessionAny[method] === "function") {
				const result = await sessionAny[method]();
				if (result?.data) {
					const data = Array.isArray(result.data) ? result.data : result.data.commands || result.data.items || [];
					return data.map((item: any) => ({
						id: item.id || item.name?.toLowerCase().replace(/\s+/g, "-"),
						name: item.name || item.id,
						description: item.description || item.help || "",
						tags: item.tags || ["command"],
					}));
				}
			}
		}
	} catch (error) {
		logger?.log({
			body: {
				service: "a2a-plugin",
				level: "debug",
				message: "Command discovery fallback failed",
				extra: { error: error instanceof Error ? error.message : String(error) },
			},
		});
	}

	return [];
}

/**
 * Get tools from OpenCode session API
 * Note: This method may not exist in all versions - uses fallback
 */
async function getTools(
	client: OpenCodeClient,
	logger?: Logger,
): Promise<DiscoveredSkill[]> {
	const sessionAny = client.session as any;

	// Try to call session.getTools if it exists
	if (typeof sessionAny.getTools === "function") {
		const result = await sessionAny.getTools();
		if (result?.data?.tools) {
			return result.data.tools.map((tool: any) => ({
				id: tool.id || tool.name?.toLowerCase().replace(/\s+/g, "-"),
				name: tool.name || tool.id,
				description: tool.description || "",
				tags: tool.tags || ["tool"],
			}));
		}
	}

	// Fallback: Try alternative method names
	try {
		const methodsToTry = ["listTools", "getAvailableTools", "tools"];
		for (const method of methodsToTry) {
			if (typeof sessionAny[method] === "function") {
				const result = await sessionAny[method]();
				if (result?.data) {
					const data = Array.isArray(result.data) ? result.data : result.data.tools || result.data.items || [];
					return data.map((item: any) => ({
						id: item.id || item.name?.toLowerCase().replace(/\s+/g, "-"),
						name: item.name || item.id,
						description: item.description || "",
						tags: item.tags || ["tool"],
					}));
				}
			}
		}
	} catch (error) {
		logger?.log({
			body: {
				service: "a2a-plugin",
				level: "debug",
				message: "Tool discovery fallback failed",
				extra: { error: error instanceof Error ? error.message : String(error) },
			},
		});
	}

	return [];
}

/**
 * Get plugin skills from OpenCode session API
 * Note: This method may not exist in all versions - uses fallback
 */
async function getPluginSkills(
	client: OpenCodeClient,
	logger?: Logger,
): Promise<DiscoveredSkill[]> {
	const sessionAny = client.session as any;

	// Try to call session.getPluginSkills if it exists
	if (typeof sessionAny.getPluginSkills === "function") {
		const result = await sessionAny.getPluginSkills();
		if (result?.data?.skills) {
			return result.data.skills.map((skill: any) => ({
				id: skill.id,
				name: skill.name,
				description: skill.description || "",
				tags: skill.tags || ["plugin"],
			}));
		}
	}

	// Fallback: Try alternative method names
	try {
		const methodsToTry = ["listPluginSkills", "getSkills", "skills"];
		for (const method of methodsToTry) {
			if (typeof sessionAny[method] === "function") {
				const result = await sessionAny[method]();
				if (result?.data) {
					const data = Array.isArray(result.data) ? result.data : result.data.skills || result.data.items || [];
					return data.map((item: any) => ({
						id: item.id || item.name?.toLowerCase().replace(/\s+/g, "-"),
						name: item.name || item.id,
						description: item.description || "",
						tags: item.tags || ["plugin"],
					}));
				}
			}
		}
	} catch (error) {
		logger?.log({
			body: {
				service: "a2a-plugin",
				level: "debug",
				message: "Plugin skills discovery fallback failed",
				extra: { error: error instanceof Error ? error.message : String(error) },
			},
		});
	}

	return [];
}

/**
 * Deduplicate skills by ID
 */
function deduplicateSkills(skills: DiscoveredSkill[]): DiscoveredSkill[] {
	const seen = new Map<string, DiscoveredSkill>();

	for (const skill of skills) {
		const id = skill.id.toLowerCase();
		if (!seen.has(id)) {
			seen.set(id, skill);
		}
	}

	return Array.from(seen.values());
}

/**
 * Get default skills (fallback when discovery fails)
 */
export function getDefaultSkills(): DiscoveredSkill[] {
	return [...DEFAULT_SKILLS];
}