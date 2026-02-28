/**
 * A2A Client Utilities
 * 
 * Helper functions for working with A2A clients
 */

import { ClientFactory, ClientFactoryOptions } from "@a2a-js/sdk/client";
import { v4 as uuidv4 } from "uuid";
import { AuthInterceptor } from "./interceptor.js";
import type { AgentCard, A2AMessage, MessagePart } from "./types.js";

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
    }) as any
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
): Promise<{ kind: "message" | "task"; parts?: MessagePart[]; id?: string; status?: { state: string } }> {
  const params = {
    message: {
      kind: "message",
      messageId: uuidv4(),
      role: "user",
      parts: [{ kind: "text", text: message }] as MessagePart[],
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
): AsyncGenerator<A2AMessage> {
  const params = {
    message: {
      kind: "message",
      messageId: uuidv4(),
      role: "user",
      parts: [{ kind: "text", text: message }] as MessagePart[],
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
      throw new Error(`Failed to fetch Agent Card: ${response.status} ${response.statusText}`);
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
        throw new Error(`Network timeout while fetching Agent Card from ${url}`);
      }
      throw error;
    }
    throw new Error(`Failed to fetch Agent Card: ${String(error)}`);
  }
}