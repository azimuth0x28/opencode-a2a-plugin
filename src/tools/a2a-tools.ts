/**
 * A2A Tools for OpenCode
 * 
 * Custom tools that allow agents to interact with A2A agents
 * Uses proper OpenCode tool format
 * Uses factory pattern to avoid global mutable state
 */

import { tool } from "@opencode-ai/plugin/tool";
import { sendToA2AAgent, fetchAgentCard } from "../client.js";
import type { A2APluginConfig, A2AClient } from "../types.js";

/**
 * Create A2A tools with dependency injection
 * This avoids global mutable state and makes testing easier
 */
export function createA2ATools(
  config: A2APluginConfig,
  getClient: () => Promise<A2AClient | undefined>
) {
  // Helper for consistent error formatting
  const formatError = (message: string, error: unknown): string => {
    return `Error: ${error instanceof Error ? error.message : message}`;
  };

  // Tool: Send message to A2A agent
  const a2a_send = tool({
    description: "Send a message to an A2A agent. Uses default URL from config if agentUrl not provided.",
    args: {
      message: tool.schema.string().describe("Message to send to the A2A agent"),
      agentUrl: tool.schema.string().optional().describe("Optional. A2A agent URL. Defaults to config value"),
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
        const response = await sendToA2AAgent(client, args.message);

        if (response.kind === "message") {
          const parts = response.parts || [];
          const textParts = parts.filter((p): p is { kind: "text"; text: string } => p.kind === "text");
          const text = textParts.map((p) => p.text).join("\n");
          return text || "Empty response from agent";
        } else if (response.kind === "task") {
          return `Task created: ${response.id}\nStatus: ${response.status?.state || "unknown"}`;
        } else if (response.kind === "error") {
          return `Error: ${(response as any).message || "Unknown error"}`;
        }

        return `Unexpected response type: ${(response as any).kind}`;
      } catch (error) {
        return formatError("Unknown error", error);
      }
    },
  });

  // Tool: Discover A2A agent capabilities
  const a2a_discover = tool({
    description: "Fetch and display agent capabilities from an A2A agent card",
    args: {
      agentUrl: tool.schema.string().describe("URL of the A2A agent to discover"),
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

  // Tool: Get task status
  const a2a_task_status = tool({
    description: "Get the status of a running A2A task",
    args: {
      taskId: tool.schema.string().describe("ID of the task to check"),
      agentUrl: tool.schema.string().optional().describe("Optional A2A agent URL"),
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
        const task = await client.getTask({ id: args.taskId });
        
        let output = `Task ID: ${task.id}\n`;
        output += `Status: ${task.status.state}\n`;
        
        if (task.status.message?.parts?.[0]?.text) {
          output += `Message: ${task.status.message.parts[0].text}\n`;
        }
        
        output += `Artifacts: ${task.artifacts?.length || 0}`;
        
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
      agentUrl: tool.schema.string().optional().describe("Optional A2A agent URL"),
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
        const task = await client.cancelTask(args.taskId);
        
        return `Task ${task.id} cancelled. Status: ${task.status.state}`;
      } catch (error) {
        return formatError("Failed to cancel task", error);
      }
    },
  });

  return {
    a2a_send,
    a2a_discover,
    a2a_task_status,
    a2a_cancel,
  };
}

/**
 * @deprecated Use createA2ATools() instead for better testability
 * Initialize the tools with plugin context (legacy compatibility)
 */
export function initA2ATools(config: A2APluginConfig, clientGetter: () => Promise<any>) {
  // Legacy function - creates tools and returns them (but they're not used)
  // This is kept for backward compatibility with index.ts
  return createA2ATools(config, clientGetter);
}