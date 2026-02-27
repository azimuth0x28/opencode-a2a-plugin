/**
 * A2A Client Utilities
 * 
 * Helper functions for working with A2A clients
 */

import { ClientFactory, ClientFactoryOptions } from "@a2a-js/sdk/client";
import { v4 as uuidv4 } from "uuid";
import { AuthInterceptor } from "./interceptor.js";

// Re-export types from main SDK
export type { } from "@a2a-js/sdk";

/**
 * Create an A2A client for a specific agent
 */
export async function createA2AClient(
  agentUrl: string, 
  authToken?: string, 
  apiKey?: string
): Promise<any> {
  const interceptors: any[] = [];
  
  if (authToken || apiKey) {
    interceptors.push(new AuthInterceptor(authToken, apiKey));
  }

  const factory = new ClientFactory(
    ClientFactoryOptions.createFrom(ClientFactoryOptions.default, {
      clientConfig: {
        interceptors,
      },
    })
  );

  return factory.createFromUrl(agentUrl);
}

/**
 * Send a message to an A2A agent
 */
export async function sendToA2AAgent(
  client: any,
  message: string,
  sessionId?: string
): Promise<any> {
  const params = {
    message: {
      kind: "message",
      messageId: uuidv4(),
      role: "user",
      parts: [{ kind: "text", text: message }],
    },
    sessionId,
  };

  return client.sendMessage(params);
}

/**
 * Stream messages from an A2A agent
 */
export async function* streamFromA2AAgent(
  client: any,
  message: string,
  sessionId?: string
): AsyncGenerator<any> {
  const params = {
    message: {
      kind: "message",
      messageId: uuidv4(),
      role: "user",
      parts: [{ kind: "text", text: message }],
    },
    sessionId,
  };

  yield* client.sendMessageStream(params);
}

/**
 * Fetch an Agent Card from a URL
 */
export async function fetchAgentCard(url: string): Promise<any> {
  const response = await fetch(`${url}/.well-known/agent-card.json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch Agent Card: ${response.status}`);
  }
  return response.json();
}