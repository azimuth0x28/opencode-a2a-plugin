/**
 * A2A Plugin for OpenCode
 *
 * This plugin enables OpenCode to communicate with A2A-compatible agents
 * and optionally expose OpenCode as an A2A server.
 *
 * Based on A2A Protocol v0.3.0 - https://a2a-protocol.org/v0.3.0/specification/
 * Uses official @a2a-js/sdk library
 */

import { ClientFactory, ClientFactoryOptions } from "@a2a-js/sdk/client";
import type { A2APluginConfig, A2AClientState, Logger } from "./src/types.js";
import { AuthInterceptor } from "./src/interceptor.js";
import { startA2AServer } from "./src/server.js";
import { loadA2AConfig, getDefaultConfig } from "./src/config.js";
import { setLogger, log } from "./src/utils/logger.js";
import { createA2ATools } from "./src/tools/a2a-tools.js";

/**
 * Sanitize URL to remove potential credentials
 */
function sanitizeUrl(url: string | undefined): string | undefined {
	if (!url) return url;
	try {
		const parsed = new URL(url);
		if (parsed.password) {
			parsed.password = "***";
		}
		return parsed.toString();
	} catch {
		return url;
	}
}

// Plugin type - simplified for compatibility
// Simplified plugin type (OpenCode ctx unknown)
type OpenCodePlugin = (ctx: unknown) => Promise<unknown>;

/**
 * Main Plugin
 */
export const A2APlugin: OpenCodePlugin = async (ctx) => {
	const client = (ctx as any).client;

	// Load configuration from a2a.json file
	const userConfig = await loadA2AConfig();
	const defaults = getDefaultConfig();
	const config: A2APluginConfig = { ...defaults, ...userConfig };

	// Create logger and set global instance
	const logger: Logger = {
		log: async (params: {
			body: {
				service: string;
				level: string;
				message: string;
				extra?: Record<string, unknown>;
			};
		}) => {
			try {
				await client.app.log(params);
			} catch (_e) {
				// Fallback to console if logging fails
				console.log(
					`[${params.body.service}] ${params.body.level}: ${params.body.message}`,
				);
			}
		},
	};
	setLogger(logger);

	await log.info("plugin", "Initializing A2A plugin", {
		agentUrl: sanitizeUrl(config.agentUrl),
		serverMode: config.serverMode,
		port: config.port,
		hasAuth: !!(config.authToken || config.apiKey),
	});

	// Initialize client state with factory
	// Set up authentication interceptor FIRST if needed
	let factory: ClientFactory;
	if (config.authToken || config.apiKey) {
		const interceptor = new AuthInterceptor(config.authToken, config.apiKey);
		factory = new ClientFactory(
			ClientFactoryOptions.createFrom(ClientFactoryOptions.default, {
				clientConfig: {
					interceptors: [interceptor],
				},
			}),
		);
	} else {
		factory = new ClientFactory();
	}

	const clientState: A2AClientState = {
		factory,
	};

	// Lazy client getter - uses the properly configured factory
	const clientGetter = async () => {
		if (!clientState.client && config.agentUrl) {
			clientState.client = await clientState.factory.createFromUrl(
				config.agentUrl,
			);
		}
		return clientState.client;
	};

	// Initialize A2A client if URL is provided (using the factory with or without auth)
	if (config.agentUrl) {
		try {
			await clientGetter();
			await log.info("plugin", "Connected to A2A agent", {
				agentUrl: sanitizeUrl(config.agentUrl),
			});
		} catch (error) {
			await log.error("plugin", "Failed to connect to A2A agent", {
				agentUrl: sanitizeUrl(config.agentUrl),
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	// Start A2A Server if enabled
	if (config.serverMode) {
		await startA2AServer(config, logger, client);
	}

	// Initialize A2A tools with config (using factory pattern)
	const a2aTools = createA2ATools(config, clientGetter);

	return {
		// Custom tools - use factory-created tools
		tool: {
			...a2aTools,
		},

		// Config hook - modify OpenCode configuration
		config: async (cfg: any) => {
			// Add A2A-related commands
			(cfg as any).command = {
				...cfg.command,
				"a2a-send": {
					description: "Send message to A2A agent",
					agent: "OpenAgent",
					template: `Use a2a_send tool to send: $ARGUMENTS`,
				},
				"a2a-discover": {
					description: "Discover A2A agent capabilities",
					agent: "OpenAgent",
					template: `Use a2a_discover tool to discover agent at: $ARGUMENTS`,
				},
			};
			return cfg;
		},

		// Event hooks
		event: async (ctx: any) => {
			const event = ctx.event;
			if (event.type === "session.start") {
				await log.info("events", "Session started");
			} else if (event.type === "session.idle") {
				await log.info("events", "Session idle");
			}
		},
	};
};

export default A2APlugin;

// Re-export utilities
export {
	sendToA2AAgent,
	fetchAgentCard,
	getExtendedAgentCard,
	listTasks,
	subscribeToTask,
	createTaskPushNotificationConfig,
	getTaskPushNotificationConfig,
	listTaskPushNotificationConfigs,
	deleteTaskPushNotificationConfig,
} from "./src/client.js";
export type {
	A2APluginConfig,
	ListTasksRequest,
	ListTasksResponse,
	CreatePushNotificationConfigRequest,
	GetPushNotificationConfigRequest,
	DeletePushNotificationConfigRequest,
	A2AClientState,
	A2AClient,
	Logger,
	Task,
	AgentCard,
} from "./src/types.js";

// Re-export SDK types for convenience
export type {
	Part,
	Artifact,
	Message,
	TaskPushNotificationConfig,
} from "@a2a-js/sdk";

// Re-export discovery and skill-mapper for external use
export { discoverSkills, getDefaultSkills } from "./src/discovery.js";
export { mapToAgentSkills, mapDiscoveryResultToAgentSkills, isValidAgentSkill, filterValidAgentSkills, createStructuredSkill } from "./src/skill-mapper.js";
export type { DiscoveredSkill, DiscoveryResult } from "./src/discovery.js";
export type { AgentSkill } from "@a2a-js/sdk";
