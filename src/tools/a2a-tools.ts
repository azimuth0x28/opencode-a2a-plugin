/**
 * A2A Tools for OpenCode
 *
 * Custom tools that allow agents to interact with A2A agents
 * Uses proper OpenCode tool format
 * Uses factory pattern to avoid global mutable state
 */

import { tool } from "@opencode-ai/plugin/tool";
import type { Client } from "@a2a-js/sdk/client";
import type {
	Part,
	Artifact,
	Task,
	AgentCard,
	TaskPushNotificationConfig,
	SendMessageResponse,
	SendMessageSuccessResponse,
	JSONRPCErrorResponse,
	TaskState,
} from "@a2a-js/sdk";
import {
	sendToA2AAgent,
	fetchAgentCard,
	getExtendedAgentCard,
	listTasks,
	subscribeToTask,
	createTaskPushNotificationConfig,
	getTaskPushNotificationConfig,
	listTaskPushNotificationConfigs,
	deleteTaskPushNotificationConfig,
} from "../client.js";
import type {
	A2APluginConfig,
	A2AClient,
	ListTasksRequest,
	CreatePushNotificationConfigRequest,
	GetPushNotificationConfigRequest,
	DeletePushNotificationConfigRequest,
} from "../types.js";

// Re-export types from client for convenience
export type { MessagePart, PushNotificationConfig } from "../client.js";

/**
 * Return type for A2A tools
 */
interface A2AToolsReturn {
	a2a_send: ReturnType<typeof tool>;
	a2a_discover: ReturnType<typeof tool>;
	a2a_task_status: ReturnType<typeof tool>;
	a2a_cancel: ReturnType<typeof tool>;
	a2a_list_tasks: ReturnType<typeof tool>;
	a2a_subscribe: ReturnType<typeof tool>;
	a2a_stream: ReturnType<typeof tool>;
	a2a_create_push: ReturnType<typeof tool>;
	a2a_get_push: ReturnType<typeof tool>;
	a2a_list_push: ReturnType<typeof tool>;
	a2a_delete_push: ReturnType<typeof tool>;
	a2a_extended_card: ReturnType<typeof tool>;
}

/**
 * Create A2A tools with dependency injection
 * This avoids global mutable state and makes testing easier
 */
export function createA2ATools(
	config: A2APluginConfig,
	getClient: () => Promise<A2AClient | undefined>,
): A2AToolsReturn {
	// Helper for consistent error formatting
	const formatError = (message: string, error: unknown): string => {
		return `Error: ${error instanceof Error ? error.message : message}`;
	};

	// Helper to format artifacts according to A2A spec
	const formatArtifacts = (artifacts: Artifact[] | undefined): string => {
		if (!artifacts || artifacts.length === 0) {
			return "No artifacts";
		}

		let output = "";
		for (const artifact of artifacts) {
			output += `\n## Artifact: ${artifact.name || artifact.artifactId}\n`;
			if (artifact.description) {
				output += `Description: ${artifact.description}\n`;
			}
			output += `ID: ${artifact.artifactId}\n`;

			// Format parts content
			for (const part of artifact.parts) {
				if (part.kind === "text") {
					output += `\n${part.text}\n`;
				} else if (part.kind === "file") {
					// File part is a discriminated union: FileWithBytes or FileWithUri
					if ("uri" in part.file) {
						output += `[File: ${part.file.mimeType}] ${part.file.uri}\n`;
					} else if ("bytes" in part.file) {
						output += `[File: ${part.file.mimeType}] ${part.file.bytes.substring(0, 50)}...\n`;
					}
				}
			}
		}
		return output;
	};

	// Helper to format message parts
	const formatMessageParts = (parts: Part[] | undefined): string => {
		if (!parts || parts.length === 0) {
			return "";
		}
		return parts
			.filter((p): p is { kind: "text"; text: string } => p.kind === "text")
			.map((p) => p.text)
			.join("\n");
	};

	// Tool: Send message to A2A agent
	const a2a_send = tool({
		description:
			"Send a message to an A2A agent. Uses default URL from config if agentUrl not provided. Returns full task response including artifacts.",
		args: {
			message: tool.schema
				.string()
				.describe("Message to send to the A2A agent"),
			agentUrl: tool.schema
				.string()
				.optional()
				.describe("Optional. A2A agent URL. Defaults to config value"),
			blocking: tool.schema
				.boolean()
				.optional()
				.default(true)
				.describe("Wait for task completion (default: true)"),
		},
		execute: async (args) => {
			const agentUrl = args.agentUrl || config.agentUrl;

			if (!agentUrl) {
				return "Error: No agent URL configured. Set agentUrl in a2a.jsonc";
			}

			try {
				const client = await getClient();
				if (!client) {
					return "Error: A2A client not initialized. Check configuration.";
				}

				// Use blocking=true by default to get full response
				const response = await sendToA2AAgent(
					client,
					args.message,
					undefined,
					args.blocking ?? true,
				);

				if (response.kind === "message") {
					const text = formatMessageParts(response.parts);
					return text || "Empty response from agent";
				} else if (response.kind === "task") {
					// For non-blocking, return task info immediately
					if (!args.blocking) {
						return `Task created: ${response.id}\nStatus: ${response.status?.state || "unknown"}\nContext ID: ${response.contextId || "N/A"}`;
					}

					// For blocking mode, fetch the completed task to get artifacts
					try {
						const task = await client.getTask({ id: response.id! });
						let output = `Task ID: ${task.id}\n`;
						output += `Status: ${task.status.state}\n`;
						output += `Context ID: ${task.contextId || "N/A"}\n`;

						// Include status message if present
						if (task.status.message) {
							const msgText = formatMessageParts(task.status.message.parts);
							if (msgText) {
								output += `\n## Message\n${msgText}\n`;
							}
						}

						// Include artifacts
						output += formatArtifacts(task.artifacts);

						return output;
					} catch (_taskError) {
						// If we can't get task details, return basic info
						return `Task created: ${response.id}\nStatus: ${response.status?.state || "unknown"}\nContext ID: ${response.contextId || "N/A"}`;
					}
				} else if (response.kind === "error") {
					// Handle error response properly
					return "Error: An error occurred during communication";
				}

				return `Unexpected response type`;
			} catch (error) {
				return formatError("Unknown error", error);
			}
		},
	});

	// Tool: Discover A2A agent capabilities
	const a2a_discover = tool({
		description: "Fetch and display agent capabilities from an A2A agent card",
		args: {
			agentUrl: tool.schema
				.string()
				.describe("URL of the A2A agent to discover"),
		},
		execute: async (args) => {
			try {
				const card = await fetchAgentCard(args.agentUrl);

				let output = `# Agent: ${card.name}\n\n`;
				output += `${card.description}\n\n`;
				output += `**Version:** ${card.version}\n`;
				output += `**Protocol Version:** ${card.protocolVersion || "unknown"}\n`;
				output += `**URL:** ${card.url}\n\n`;

				if (card.capabilities) {
					output += `## Capabilities\n`;
					output += `- Streaming: ${card.capabilities.streaming ? "✅ Yes" : "❌ No"}\n`;
					output += `- Push Notifications: ${card.capabilities.pushNotifications ? "✅ Yes" : "❌ No"}\n\n`;
				}

				if (card.skills && card.skills.length > 0) {
					output += `## Skills\n`;
					for (const s of card.skills) {
						output += `- **${s.name}**: ${s.description}\n`;
					}
				}

				return output;
			} catch (error) {
				return formatError("Failed to fetch agent card", error);
			}
		},
	});

	// Tool: Get task status (Get Task - Section 3.1.3 of spec)
	const a2a_task_status = tool({
		description:
			"Get the status of a running A2A task, including artifacts and history",
		args: {
			taskId: tool.schema.string().describe("ID of the task to check"),
			agentUrl: tool.schema
				.string()
				.optional()
				.describe("Optional A2A agent URL"),
			includeHistory: tool.schema
				.boolean()
				.optional()
				.default(false)
				.describe("Include message history"),
		},
		execute: async (args) => {
			const agentUrl = args.agentUrl || config.agentUrl;

			if (!agentUrl) {
				return "Error: No agent URL configured";
			}

			try {
				const client = await getClient();
				if (!client) {
					return "Error: A2A client not initialized. Check configuration.";
				}

				const task = await client.getTask({
					id: args.taskId,
					historyLength: args.includeHistory ? undefined : 0,
				});

				let output = `# Task: ${task.id}\n\n`;
				output += `**Status:** ${task.status.state}\n`;
				output += `**Context ID:** ${task.contextId || "N/A"}\n`;

				if (task.status.timestamp) {
					output += `**Last Updated:** ${task.status.timestamp}\n`;
				}

				// Include status message if present
				if (task.status.message) {
					const msgText = formatMessageParts(task.status.message.parts);
					if (msgText) {
						output += `\n## Status Message\n${msgText}\n`;
					}
				}

				// Include artifacts
				output += `\n## Artifacts (${task.artifacts?.length || 0})\n`;
				output += formatArtifacts(task.artifacts);

				// Include history if requested
				if (args.includeHistory && task.history && task.history.length > 0) {
					output += `\n## History (${task.history.length} messages)\n`;
					for (const msg of task.history) {
						output += `\n### ${msg.role}: ${msg.messageId}\n`;
						output += `${formatMessageParts(msg.parts)}\n`;
					}
				}

				return output;
			} catch (error) {
				return formatError("Failed to get task status", error);
			}
		},
	});

	// Tool: Cancel task
	const a2a_cancel = tool({
		description: "Cancel a running A2A task",
		args: {
			taskId: tool.schema.string().describe("ID of the task to cancel"),
			agentUrl: tool.schema
				.string()
				.optional()
				.describe("Optional A2A agent URL"),
		},
		execute: async (args) => {
			const agentUrl = args.agentUrl || config.agentUrl;

			if (!agentUrl) {
				return "Error: No agent URL configured";
			}

			try {
				const client = await getClient();
				if (!client) {
					return "Error: A2A client not initialized. Check configuration.";
				}
				const task = await client.cancelTask({ id: args.taskId });

				return `Task ${task.id} cancelled. Status: ${task.status.state}`;
			} catch (error) {
				return formatError("Failed to cancel task", error);
			}
		},
	});

	// Tool: List tasks (Section 3.1.4 of spec)
	const a2a_list_tasks = tool({
		description: "List tasks with optional filtering and pagination",
		args: {
			contextId: tool.schema
				.string()
				.optional()
				.describe("Filter by context ID"),
			status: tool.schema
				.array(tool.schema.string())
				.optional()
				.describe(
					"Filter by task status (submitted, working, completed, canceled, failed, input-required)",
				),
			limit: tool.schema
				.number()
				.optional()
				.describe("Number of items per page (default: 10)"),
			pageToken: tool.schema
				.string()
				.optional()
				.describe("Page token for pagination"),
			includeArtifacts: tool.schema
				.boolean()
				.optional()
				.default(false)
				.describe("Include artifacts in response"),
			agentUrl: tool.schema
				.string()
				.optional()
				.describe("Optional A2A agent URL"),
		},
		execute: async (args) => {
			const agentUrl = args.agentUrl || config.agentUrl;

			if (!agentUrl) {
				return "Error: No agent URL configured";
			}

			try {
				const client = await getClient();
				if (!client) {
					return "Error: A2A client not initialized. Check configuration.";
				}

				const result = await listTasks(client, {
					contextId: args.contextId,
					status: (args.status as TaskState[]) || undefined,
					limit: args.limit || 10,
					pageToken: args.pageToken,
					includeArtifacts: args.includeArtifacts,
				});

				let output = `# Tasks (${result.tasks.length})\n\n`;

				for (const task of result.tasks) {
					output += `## Task: ${task.id}\n`;
					output += `Status: ${task.status.state}\n`;
					output += `Context ID: ${task.contextId || "N/A"}\n`;
					output += `Artifacts: ${task.artifacts?.length || 0}\n`;

					if (
						args.includeArtifacts &&
						task.artifacts &&
						task.artifacts.length > 0
					) {
						output += formatArtifacts(task.artifacts);
					}
					output += "\n";
				}

				if (result.nextPageToken) {
					output += `\n**Next Page Token:** ${result.nextPageToken}`;
				}

				return output;
			} catch (error) {
				return formatError("Failed to list tasks", error);
			}
		},
	});

	// Tool: Subscribe to task (Section 3.1.6 of spec)
	const a2a_subscribe = tool({
		description:
			"Subscribe to real-time updates for a task. Returns task status and artifacts.",
		args: {
			taskId: tool.schema.string().describe("ID of the task to subscribe to"),
			agentUrl: tool.schema
				.string()
				.optional()
				.describe("Optional A2A agent URL"),
		},
		execute: async (args) => {
			const agentUrl = args.agentUrl || config.agentUrl;

			if (!agentUrl) {
				return "Error: No agent URL configured";
			}

			try {
				const client = await getClient();
				if (!client) {
					return "Error: A2A client not initialized. Check configuration.";
				}

				// Use resubscribeTask to get real-time updates
				const stream = client.resubscribeTask({ id: args.taskId });

				let result = "";
				for await (const event of stream) {
					// Handle different event types
					if ("status" in event) {
						result += `Status: ${event.status.state}\n`;
						if (event.status.message) {
							result += `${formatMessageParts(event.status.message.parts)}\n`;
						}
					}
					if ("artifacts" in event && event.artifacts) {
						result += formatArtifacts(event.artifacts);
					}
				}

				return (
					result || `Subscribed to task ${args.taskId}. No updates received.`
				);
			} catch (error) {
				return formatError("Failed to subscribe to task", error);
			}
		},
	});

	// Tool: Send streaming message (Section 3.1.2 of spec)
	const a2a_stream = tool({
		description: "Send a message to A2A agent with streaming response",
		args: {
			message: tool.schema
				.string()
				.describe("Message to send to the A2A agent"),
			agentUrl: tool.schema
				.string()
				.optional()
				.describe("Optional. A2A agent URL. Defaults to config value"),
		},
		execute: async (args) => {
			const agentUrl = args.agentUrl || config.agentUrl;

			if (!agentUrl) {
				return "Error: No agent URL configured. Set agentUrl in a2a.jsonc";
			}

			try {
				const client = await getClient();
				if (!client) {
					return "Error: A2A client not initialized. Check configuration.";
				}

				const stream = client.sendMessageStream({
					message: {
						kind: "message",
						messageId: crypto.randomUUID(),
						role: "user",
						parts: [{ kind: "text", text: args.message }],
					},
				});

				let result = "";
				for await (const event of stream) {
					if (event.kind === "status-update") {
						result += `[${event.status.state}] `;
					} else if (event.kind === "artifact-update") {
						result += formatArtifacts(
							event.artifact ? [event.artifact] : undefined,
						);
					} else if (event.kind === "message") {
						result += formatMessageParts(event.parts);
					}
				}

				return result || "Streaming completed. No content received.";
			} catch (error) {
				return formatError("Streaming failed", error);
			}
		},
	});

	// Tool: Create push notification config (Section 3.1.7 of spec)
	const a2a_create_push = tool({
		description: "Create push notification configuration for a task",
		args: {
			taskId: tool.schema.string().describe("ID of the task"),
			url: tool.schema
				.string()
				.describe("Webhook URL to receive notifications"),
			name: tool.schema
				.string()
				.optional()
				.describe("Optional name for this configuration"),
			agentUrl: tool.schema
				.string()
				.optional()
				.describe("Optional A2A agent URL"),
		},
		execute: async (args) => {
			const agentUrl = args.agentUrl || config.agentUrl;

			if (!agentUrl) {
				return "Error: No agent URL configured";
			}

			try {
				const client = await getClient();
				if (!client) {
					return "Error: A2A client not initialized. Check configuration.";
				}

				const config_result = await createTaskPushNotificationConfig(client, {
					taskId: args.taskId,
					url: args.url,
					name: args.name,
				});

				return `Push notification config created:\nID: ${config_result.pushNotificationConfig?.id || "N/A"}\nTask ID: ${config_result.taskId}\nURL: ${config_result.pushNotificationConfig?.url}`;
			} catch (error) {
				return formatError("Failed to create push notification config", error);
			}
		},
	});

	// Tool: Get push notification config (Section 3.1.8 of spec)
	const a2a_get_push = tool({
		description: "Get push notification configuration for a task",
		args: {
			taskId: tool.schema.string().describe("ID of the task"),
			configId: tool.schema
				.string()
				.describe("ID of the push notification config"),
			agentUrl: tool.schema
				.string()
				.optional()
				.describe("Optional A2A agent URL"),
		},
		execute: async (args) => {
			const agentUrl = args.agentUrl || config.agentUrl;

			if (!agentUrl) {
				return "Error: No agent URL configured";
			}

			try {
				const client = await getClient();
				if (!client) {
					return "Error: A2A client not initialized. Check configuration.";
				}

				const config_result = await getTaskPushNotificationConfig(client, {
					taskId: args.taskId,
					id: args.configId,
				});

				return `# Push Notification Config: ${config_result.pushNotificationConfig?.id || "N/A"}\nTask ID: ${config_result.taskId}\nURL: ${config_result.pushNotificationConfig?.url}`;
			} catch (error) {
				return formatError("Failed to get push notification config", error);
			}
		},
	});

	// Tool: List push notification configs (Section 3.1.9 of spec)
	const a2a_list_push = tool({
		description: "List push notification configurations for a task",
		args: {
			taskId: tool.schema.string().describe("ID of the task"),
			agentUrl: tool.schema
				.string()
				.optional()
				.describe("Optional A2A agent URL"),
		},
		execute: async (args) => {
			const agentUrl = args.agentUrl || config.agentUrl;

			if (!agentUrl) {
				return "Error: No agent URL configured";
			}

			try {
				const client = await getClient();
				if (!client) {
					return "Error: A2A client not initialized. Check configuration.";
				}

				const result = await listTaskPushNotificationConfigs(
					client,
					args.taskId,
				);

				let output = `# Push Notification Configs (${result.configs.length})\n\n`;
				for (const cfg of result.configs) {
					output += `## ${cfg.pushNotificationConfig?.id || "N/A"}\n`;
					output += `Task ID: ${cfg.taskId}\n`;
					output += `URL: ${cfg.pushNotificationConfig?.url}\n\n`;
				}

				return output;
			} catch (error) {
				return formatError("Failed to list push notification configs", error);
			}
		},
	});

	// Tool: Delete push notification config (Section 3.1.10 of spec)
	const a2a_delete_push = tool({
		description: "Delete push notification configuration for a task",
		args: {
			taskId: tool.schema.string().describe("ID of the task"),
			configId: tool.schema
				.string()
				.describe("ID of the push notification config to delete"),
			agentUrl: tool.schema
				.string()
				.optional()
				.describe("Optional A2A agent URL"),
		},
		execute: async (args) => {
			const agentUrl = args.agentUrl || config.agentUrl;

			if (!agentUrl) {
				return "Error: No agent URL configured";
			}

			try {
				const client = await getClient();
				if (!client) {
					return "Error: A2A client not initialized. Check configuration.";
				}

				await deleteTaskPushNotificationConfig(client, {
					taskId: args.taskId,
					id: args.configId,
				});

				return `Push notification config ${args.configId} deleted for task ${args.taskId}`;
			} catch (error) {
				return formatError("Failed to delete push notification config", error);
			}
		},
	});

	// Tool: Get extended agent card (Section 3.1.11 of spec)
	const a2a_extended_card = tool({
		description: "Get extended agent card (requires authentication)",
		args: {
			agentUrl: tool.schema
				.string()
				.optional()
				.describe("Optional A2A agent URL"),
		},
		execute: async (args) => {
			const agentUrl = args.agentUrl || config.agentUrl;

			if (!agentUrl) {
				return "Error: No agent URL configured";
			}

			try {
				const client = await getClient();
				if (!client) {
					return "Error: A2A client not initialized. Check configuration.";
				}

				const card = await getExtendedAgentCard(client);

				let output = `# Extended Agent Card: ${card.name}\n\n`;
				output += `${card.description}\n\n`;
				output += `**Version:** ${card.version}\n`;
				output += `**Protocol Version:** ${card.protocolVersion || "unknown"}\n\n`;

				if (card.capabilities) {
					output += `## Capabilities\n`;
					output += `- Streaming: ${card.capabilities.streaming ? "✅ Yes" : "❌ No"}\n`;
					output += `- Push Notifications: ${card.capabilities.pushNotifications ? "✅ Yes" : "❌ No"}\n`;
					output += `\nNote: Use a2a_extended_card tool to get extended agent card\n\n`;
				}

				if (card.skills && card.skills.length > 0) {
					output += `## Skills\n`;
					for (const s of card.skills) {
						output += `- **${s.name}**: ${s.description}\n`;
					}
				}

				return output;
			} catch (error) {
				return formatError("Failed to get extended agent card", error);
			}
		},
	});

	return {
		a2a_send,
		a2a_discover,
		a2a_task_status,
		a2a_cancel,
		a2a_list_tasks,
		a2a_subscribe,
		a2a_stream,
		a2a_create_push,
		a2a_get_push,
		a2a_list_push,
		a2a_delete_push,
		a2a_extended_card,
	};
}

/**
 * @deprecated Use createA2ATools() instead for better testability
 * Initialize the tools with plugin context (legacy compatibility)
 */
export function initA2ATools(
	config: A2APluginConfig,
	clientGetter: () => Promise<Client | undefined>,
): A2AToolsReturn {
	// Legacy function - creates tools and returns them (but they're not used)
	// This is kept for backward compatibility with index.ts
	return createA2ATools(config, clientGetter);
}
