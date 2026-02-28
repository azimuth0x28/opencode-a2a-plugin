/**
 * OpenCode Agent Executor
 *
 * Handles A2A task execution for server mode
 * Uses OpenCode client SDK directly instead of spawning subprocess
 */

import { RequestContext, ExecutionEventBus } from "@a2a-js/sdk/server";
import { v4 as uuidv4 } from "uuid";
import type { Logger } from "./types.js";
import type { Part } from "@a2a-js/sdk";

// Type for OpenCode client SDK
export interface OpenCodeClient {
	session: {
		create: (params: {
			body: { title?: string; parentID?: string };
		}) => Promise<{ data?: { id: string } }>;
		prompt: (params: {
			path: { id: string };
			body: { parts: Array<{ type: string; text: string }>; agent?: string };
		}) => Promise<unknown>;
		messages: (params: {
			path: { id: string };
		}) => Promise<{ data?: SessionMessage[] }>;
		delete: (params: { path: { id: string } }) => Promise<unknown>;
	};
}

interface SessionMessage {
	info: { role: string };
	parts: Array<{ type: string; text: string }>;
}

export class OpenCodeAgentExecutor {
	private logger?: Logger;
	private client?: OpenCodeClient;
	private timeout: number;

	constructor(
		client?: OpenCodeClient,
		logger?: Logger,
		options?: { timeout?: number },
	) {
		this.client = client;
		this.logger = logger;
		this.timeout = options?.timeout || 120000; // 2 minutes default
	}

	async execute(
		requestContext: RequestContext,
		eventBus: ExecutionEventBus,
	): Promise<void> {
		const { taskId, contextId, userMessage, task } = requestContext;

		// Get user message text
		const textPart = userMessage.parts.find(
			(p): p is Part & { kind: "text" } => p.kind === "text",
		);
		const userText = textPart?.text || "";

		// 1. Publish initial Task event (if new task)
		if (!task) {
			eventBus.publish({
				kind: "task",
				id: taskId,
				contextId: contextId,
				status: {
					state: "submitted",
					timestamp: new Date().toISOString(),
				},
				history: [userMessage],
			});
		}

		// 2. Publish "working" status update
		this.publishWorkingStatus(eventBus, taskId, contextId);

		try {
			const response = await this.processWithOpenCode(userText);
			this.publishSuccess(eventBus, taskId, contextId, response);
		} catch (error) {
			this.publishError(eventBus, taskId, contextId, error);
		}
	}

	private publishWorkingStatus(
		eventBus: ExecutionEventBus,
		taskId: string,
		contextId: string,
	): void {
		eventBus.publish({
			kind: "status-update",
			taskId,
			contextId,
			status: {
				state: "working",
				message: {
					kind: "message",
					role: "agent",
					messageId: uuidv4(),
					parts: [
						{ kind: "text", text: "Processing your request with OpenCode..." },
					],
					taskId,
					contextId,
				},
				timestamp: new Date().toISOString(),
			},
			final: false,
		});
	}

	private publishSuccess(
		eventBus: ExecutionEventBus,
		taskId: string,
		contextId: string,
		response: string,
	): void {
		// Publish artifact with the result
		eventBus.publish({
			kind: "artifact-update",
			taskId,
			contextId,
			artifact: {
				artifactId: uuidv4(),
				name: "Result",
				description: "The result from OpenCode agent.",
				parts: [{ kind: "text", text: response }],
			},
			lastChunk: true,
		});

		// Publish final status (completed)
		eventBus.publish({
			kind: "status-update",
			taskId,
			contextId,
			status: {
				state: "completed",
				timestamp: new Date().toISOString(),
			},
			final: true,
		});
	}

	private publishError(
		eventBus: ExecutionEventBus,
		taskId: string,
		contextId: string,
		error: unknown,
	): void {
		const errorMessage = `Error: ${error instanceof Error ? error.message : "Unknown error"}`;

		// Publish artifact with error
		eventBus.publish({
			kind: "artifact-update",
			taskId,
			contextId,
			artifact: {
				artifactId: uuidv4(),
				name: "Error",
				description: "Error from OpenCode agent.",
				parts: [{ kind: "text", text: errorMessage }],
			},
			lastChunk: true,
		});

		// Publish failed status
		eventBus.publish({
			kind: "status-update",
			taskId,
			contextId,
			status: {
				state: "failed",
				message: {
					kind: "message",
					role: "agent",
					messageId: uuidv4(),
					parts: [{ kind: "text", text: errorMessage }],
					taskId,
					contextId,
				},
				timestamp: new Date().toISOString(),
			},
			final: true,
		});
	}

	async cancelTask(taskId: string, eventBus: ExecutionEventBus): Promise<void> {
		eventBus.publish({
			kind: "status-update",
			taskId,
			contextId: "",
			status: {
				state: "canceled",
				timestamp: new Date().toISOString(),
			},
			final: true,
		});

		await this.logger?.log({
			body: {
				service: "a2a-plugin",
				level: "info",
				message: `Task cancelled`,
				extra: { taskId },
			},
		});
	}

	/**
	 * Process user prompt using OpenCode client SDK
	 * Creates a session, sends the prompt, waits for completion, and retrieves the result
	 */
	private async processWithOpenCode(prompt: string): Promise<string> {
		if (!this.client) {
			throw new Error(
				"OpenCode client not available. Please configure the A2A plugin properly.",
			);
		}

		const sessionId = await this.createSession(prompt);

		try {
			await this.sendPrompt(sessionId, prompt);
			const response = await this.pollForResponse(sessionId);
			return response;
		} finally {
			await this.cleanupSession(sessionId);
		}
	}

	private async createSession(prompt: string): Promise<string> {
		if (!this.client) {
			throw new Error("OpenCode client not initialized");
		}
		const sessionResult = await this.client.session.create({
			body: {
				title: `A2A Task: ${prompt.slice(0, 50)}...`,
			},
		});

		if (!sessionResult.data?.id) {
			throw new Error("Failed to create OpenCode session");
		}

		return sessionResult.data.id;
	}

	private async sendPrompt(sessionId: string, prompt: string): Promise<void> {
		if (!this.client) {
			throw new Error("OpenCode client not initialized");
		}
		await this.client.session.prompt({
			path: { id: sessionId },
			body: {
				parts: [{ type: "text", text: prompt }],
			},
		});
	}

	private async pollForResponse(sessionId: string): Promise<string> {
		const startTime = Date.now();
		let pollInterval = 500;
		const maxInterval = 5000;

		while (Date.now() - startTime < this.timeout) {
			await new Promise((resolve) => setTimeout(resolve, pollInterval));

			// Exponential backoff
			pollInterval = Math.min(pollInterval * 1.5, maxInterval);

			const response = await this.checkForResponse(sessionId);
			if (response) {
				const elapsed = Date.now() - startTime;
				return response || `OpenCode processed your request (${elapsed}ms)`;
			}
		}

		// Timeout reached - try to get whatever we have
		const finalResponse = await this.getFinalResponse(sessionId);
		return finalResponse || `OpenCode timeout after ${this.timeout}ms`;
	}

	private async checkForResponse(sessionId: string): Promise<string | null> {
		if (!this.client) {
			return null;
		}
		try {
			const messagesResult = await this.client.session.messages({
				path: { id: sessionId },
			});

			const messages = messagesResult.data || [];
			const assistantMessages = messages.filter(
				(m) => m.info?.role === "assistant",
			);

			if (assistantMessages.length > 0) {
				const lastAssistant = assistantMessages[assistantMessages.length - 1];
				const textParts =
					lastAssistant.parts?.filter((p) => p.type === "text") || [];

				if (textParts.length > 0) {
					return textParts.map((p) => p.text).join("\n");
				}
			}
		} catch (error) {
			// Log the error for debugging but continue polling
			this.logger?.log({
				body: {
					service: "a2a-plugin",
					level: "warn",
					message: `Error checking for response`,
					extra: {
						sessionId,
						error: error instanceof Error ? error.message : String(error),
					},
				},
			});
		}

		return null;
	}

	private async getFinalResponse(sessionId: string): Promise<string | null> {
		if (!this.client) {
			return null;
		}
		try {
			const messagesResult = await this.client.session.messages({
				path: { id: sessionId },
			});
			const messages = messagesResult.data || [];
			const assistantMessages = messages.filter(
				(m) => m.info?.role === "assistant",
			);

			if (assistantMessages.length > 0) {
				const lastAssistant = assistantMessages[assistantMessages.length - 1];
				const textParts =
					lastAssistant.parts?.filter((p) => p.type === "text") || [];
				if (textParts.length > 0) {
					return textParts.map((p) => p.text).join("\n");
				}
			}
		} catch (error) {
			this.logger?.log({
				body: {
					service: "a2a-plugin",
					level: "warn",
					message: `Error getting final response`,
					extra: {
						sessionId,
						error: error instanceof Error ? error.message : String(error),
					},
				},
			});
		}

		return null;
	}

	private async cleanupSession(sessionId: string): Promise<void> {
		try {
			await this.client?.session.delete({ path: { id: sessionId } });
		} catch {
			// Ignore cleanup errors
		}
	}
}
