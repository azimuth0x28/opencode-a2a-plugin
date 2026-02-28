/**
 * A2A Client Utilities
 *
 * Helper functions for working with A2A clients
 */

import { ClientFactory, ClientFactoryOptions } from "@a2a-js/sdk/client";
import type { Client, CallInterceptor } from "@a2a-js/sdk/client";
import type {
	Part,
	Message,
	Task,
	AgentCard,
	TaskPushNotificationConfig,
	TaskStatusUpdateEvent,
	TaskArtifactUpdateEvent,
} from "@a2a-js/sdk";
import { v4 as uuidv4 } from "uuid";
import { AuthInterceptor } from "./interceptor.js";
import type {
	ListTasksRequest,
	ListTasksResponse,
	CreatePushNotificationConfigRequest,
	GetPushNotificationConfigRequest,
	DeletePushNotificationConfigRequest,
} from "./types.js";

// Re-export for convenience
export type MessagePart = Part;
export type PushNotificationConfig = TaskPushNotificationConfig;

// A2A stream event data type - union of all possible stream event types
export type A2AStreamEventData =
	| Message
	| Task
	| TaskStatusUpdateEvent
	| TaskArtifactUpdateEvent;

/**
 * Create an A2A client for a specific agent
 */
export async function createA2AClient(
	agentUrl: string,
	authToken?: string,
	apiKey?: string,
): Promise<Client> {
	const interceptors: CallInterceptor[] = [];

	if (authToken || apiKey) {
		interceptors.push(new AuthInterceptor(authToken, apiKey));
	}

	const factory = new ClientFactory(
		ClientFactoryOptions.createFrom(ClientFactoryOptions.default, {
			clientConfig: {
				interceptors,
			},
		}),
	);

	return factory.createFromUrl(agentUrl);
}

/**
 * Send a message to an A2A agent
 * @param client - A2A client instance
 * @param message - Message text to send
 * @param sessionId - Optional session ID
 * @param blocking - If true, wait for task completion (default: true for immediate results)
 */
export async function sendToA2AAgent(
	client: Client,
	message: string,
	sessionId?: string,
	blocking: boolean = true,
): Promise<{
	kind: "message" | "task";
	parts?: Part[];
	id?: string;
	status?: { state: string };
	contextId?: string;
}> {
	const params = {
		message: {
			kind: "message" as const,
			messageId: uuidv4(),
			role: "user" as const,
			parts: [{ kind: "text" as const, text: message }] as Part[],
		},
		sessionId,
		configuration: {
			blocking,
		},
	};

	return client.sendMessage(params);
}

/**
 * Stream messages from an A2A agent
 */
export async function* streamFromA2AAgent(
	client: Client,
	message: string,
	sessionId?: string,
): AsyncGenerator<A2AStreamEventData> {
	const params = {
		message: {
			kind: "message" as const,
			messageId: uuidv4(),
			role: "user" as const,
			parts: [{ kind: "text" as const, text: message }] as Part[],
		},
		sessionId,
	};

	yield* client.sendMessageStream(params);
}

/**
 * Fetch an Agent Card from a URL
 */
export async function fetchAgentCard(url: string): Promise<AgentCard> {
	// Validate URL is http/https
	let parsedUrl: URL;
	try {
		parsedUrl = new URL(url);
	} catch {
		throw new Error("Invalid URL format");
	}

	if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
		throw new Error("Only HTTP/HTTPS URLs are allowed");
	}

	try {
		const response = await fetch(`${url}/.well-known/agent-card.json`, {
			// Add timeout to handle network errors
			signal: AbortSignal.timeout(10000),
		});

		if (!response.ok) {
			throw new Error(
				`Failed to fetch Agent Card: ${response.status} ${response.statusText}`,
			);
		}

		const data = await response.json();

		// Validate required fields
		if (!data.name || !data.url) {
			throw new Error("Invalid Agent Card: missing required fields");
		}

		return data as AgentCard;
	} catch (error) {
		if (error instanceof Error) {
			if (error.name === "TimeoutError" || error.name === "AbortError") {
				throw new Error(
					`Network timeout while fetching Agent Card from ${url}`,
				);
			}
			throw error;
		}
		throw new Error(`Failed to fetch Agent Card: ${String(error)}`);
	}
}

/**
 * Get Extended Agent Card (requires authentication)
 * @see Section 3.1.11 of A2A Specification
 */
export async function getExtendedAgentCard(client: Client): Promise<AgentCard> {
	return client.getAgentCard({});
}

/**
 * List tasks with optional filtering and pagination
 * @see Section 3.1.4 of A2A Specification
 * Note: This endpoint is NOT in the SDK - it's custom for this plugin
 */
export async function listTasks(
	_client: Client,
	_params: ListTasksRequest = {},
): Promise<ListTasksResponse> {
	// SDK doesn't have listTasks - this would need server-side support
	// For now, return empty list as placeholder
	return {
		tasks: [],
		nextPageToken: "",
	};
}

/**
 * Subscribe to task updates (streaming)
 * @see Section 3.1.6 of A2A Specification
 */
export async function* subscribeToTask(
	client: Client,
	taskId: string,
): AsyncGenerator<A2AStreamEventData> {
	yield* client.resubscribeTask({ id: taskId });
}

/**
 * Create push notification configuration for a task
 * @see Section 3.1.7 of A2A Specification
 */
export async function createTaskPushNotificationConfig(
	client: Client,
	params: CreatePushNotificationConfigRequest,
): Promise<TaskPushNotificationConfig> {
	return client.setTaskPushNotificationConfig({
		taskId: params.taskId,
		pushNotificationConfig: {
			url: params.url,
			authentication: params.authentication
				? {
						schemes: params.authentication.schemes ?? [],
						credentials: params.authentication.credentials,
					}
				: undefined,
		},
	});
}

/**
 * Get push notification configuration for a task
 * @see Section 3.1.8 of A2A Specification
 */
export async function getTaskPushNotificationConfig(
	client: Client,
	params: GetPushNotificationConfigRequest,
): Promise<TaskPushNotificationConfig> {
	return client.getTaskPushNotificationConfig({
		id: params.id,
	});
}

/**
 * List push notification configurations for a task
 * @see Section 3.1.9 of A2A Specification
 */
export async function listTaskPushNotificationConfigs(
	client: Client,
	taskId: string,
): Promise<{ configs: TaskPushNotificationConfig[] }> {
	const configs = await client.listTaskPushNotificationConfig({ id: taskId });
	return { configs };
}

/**
 * Delete push notification configuration for a task
 * @see Section 3.1.10 of A2A Specification
 */
export async function deleteTaskPushNotificationConfig(
	client: Client,
	params: DeletePushNotificationConfigRequest,
): Promise<{ success: boolean }> {
	await client.deleteTaskPushNotificationConfig({
		id: params.taskId,
		pushNotificationConfigId: params.id,
	});
	return { success: true };
}
