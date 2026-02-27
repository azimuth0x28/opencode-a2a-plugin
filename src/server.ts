/**
 * A2A Server
 * 
 * Starts and manages the A2A server for OpenCode
 */

import express from "express";
import {
  agentCardHandler,
  jsonRpcHandler,
  restHandler,
  UserBuilder,
} from "@a2a-js/sdk/server/express";
import {
  DefaultRequestHandler,
  InMemoryTaskStore,
} from "@a2a-js/sdk/server";
import type { A2APluginConfig, Logger } from "./types.js";
import { OpenCodeAgentExecutor } from "./executor.js";

export async function startA2AServer(
  config: A2APluginConfig,
  logger?: Logger,
  client?: any
): Promise<void> {
  const port = config.port || 4000;
  const host = config.host || "localhost";
  const serverUrl = config.serverUrl || `http://${host}:${port}`;

  // Create Agent Card
  const agentCard = {
    name: config.agentName || "OpenCode Agent",
    description: config.agentDescription || "OpenCode AI coding assistant as A2A agent",
    protocolVersion: "0.3.0",
    version: "0.1.0",
    url: serverUrl,
    skills: [
      { id: "code-assistance", name: "Code Assistance", description: "Help with coding tasks", tags: ["code", "programming"] },
      { id: "code-review", name: "Code Review", description: "Review code for issues", tags: ["review", "quality"] },
      { id: "refactoring", name: "Refactoring", description: "Refactor code", tags: ["refactor", "cleanup"] },
    ],
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
    agentExecutor
  );

  // Set up Express server
  const expressApp = express();
  expressApp.use(express.json());

  // A2A endpoints
  expressApp.use("/.well-known/agent-card.json", agentCardHandler({ agentCardProvider: requestHandler }));
  expressApp.use("/a2a/jsonrpc", jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));
  expressApp.use("/a2a/rest", restHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));

  // Start HTTP server
  expressApp.listen(port, () => {
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
}
