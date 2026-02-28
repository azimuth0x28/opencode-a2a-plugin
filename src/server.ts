/**
 * A2A Server
 *
 * Starts and manages the A2A server for OpenCode
 */

import express, { Express } from "express";
import {
	agentCardHandler,
	jsonRpcHandler,
	restHandler,
	UserBuilder,
} from "@a2a-js/sdk/server/express";
import { DefaultRequestHandler, InMemoryTaskStore } from "@a2a-js/sdk/server";
import type { A2APluginConfig, Logger } from "./types.js";
import { OpenCodeAgentExecutor } from "./executor.js";
import type { OpenCodeClient } from "./executor";
import type { Server } from "http";
import { discoverSkills } from "./discovery.js";
import { mapDiscoveryResultToAgentSkills } from "./skill-mapper.js";

// Store server instance for graceful shutdown
let serverInstance: Server | null = null;

export async function startA2AServer(
	config: A2APluginConfig,
	logger?: Logger,
	client?: OpenCodeClient,
): Promise<void> {
	const port = config.port || 4000;
	const host = config.host || "localhost";
	const serverUrl = config.serverUrl || `http://${host}:${port}`;

	// Discover skills dynamically from OpenCode
	const discoveryResult = await discoverSkills(client, logger);
	const dynamicSkills = mapDiscoveryResultToAgentSkills(discoveryResult);

	// Create Agent Card with dynamic skills
	const agentCard = {
		name: config.agentName || "OpenCode Agent",
		description:
			config.agentDescription || "OpenCode AI coding assistant as A2A agent",
		protocolVersion: "0.3.0",
		version: "0.1.0",
		url: serverUrl,
		skills: dynamicSkills,
		capabilities: {
			streaming: config.streaming ?? true,
			pushNotifications: config.pushNotifications ?? false,
		},
		defaultInputModes: ["text"],
		defaultOutputModes: ["text"],
		additionalInterfaces: [
			{ url: `${serverUrl}/a2a/jsonrpc`, transport: "JSONRPC" },
			{ url: `${serverUrl}/a2a/rest`, transport: "HTTP+JSON" },
		],
	};

	// Create agent executor with client and logger
	const agentExecutor = new OpenCodeAgentExecutor(client, logger);

	// Create request handler
	const requestHandler = new DefaultRequestHandler(
		agentCard,
		new InMemoryTaskStore(),
		agentExecutor,
	);

	// Set up Express server
	const expressApp: Express = express();
	expressApp.use(express.json());

	// Configure authentication based on config
	// Note: Using noAuthentication for now as withToken may not exist in all SDK versions
	const userBuilder = UserBuilder.noAuthentication;

	// Log security warning if no authentication
	if (!config.authToken) {
		logger?.log({
			body: {
				service: "a2a-plugin",
				level: "warn",
				message: `A2A Server running without authentication - any client can send tasks`,
				extra: { url: serverUrl },
			},
		});
	}

	// A2A endpoints
	expressApp.use(
		"/.well-known/agent-card.json",
		agentCardHandler({ agentCardProvider: requestHandler }),
	);
	expressApp.use(
		"/a2a/jsonrpc",
		jsonRpcHandler({ requestHandler, userBuilder }),
	);
	expressApp.use("/a2a/rest", restHandler({ requestHandler, userBuilder }));

	// Start HTTP server with error handling
	serverInstance = expressApp.listen(port, () => {
		logger?.log({
			body: {
				service: "a2a-plugin",
				level: "info",
				message: `A2A Server started`,
				extra: { url: serverUrl },
			},
		});

		logger?.log({
			body: {
				service: "a2a-plugin",
				level: "info",
				message: `Agent Card available`,
				extra: { cardUrl: `${serverUrl}/.well-known/agent-card.json` },
			},
		});
	});

	// Handle server errors
	serverInstance.on("error", (error: NodeJS.ErrnoException) => {
		const errorMessage =
			error.code === "EADDRINUSE"
				? `Port ${port} is already in use`
				: error.code === "EACCES"
					? `Permission denied to use port ${port}`
					: `Server error: ${error.message}`;

		logger?.log({
			body: {
				service: "a2a-plugin",
				level: "error",
				message: `Failed to start A2A Server`,
				extra: { error: errorMessage, port, host },
			},
		});

		throw new Error(errorMessage);
	});
}

/**
 * Stop the A2A server gracefully
 */
export function stopA2AServer(): Promise<void> {
	return new Promise((resolve) => {
		if (serverInstance) {
			serverInstance.close(() => {
				serverInstance = null;
				resolve();
			});
		} else {
			resolve();
		}
	});
}
