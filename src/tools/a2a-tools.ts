/**
 * A2A Tools for OpenCode
 * 
 * Custom tools that allow agents to interact with A2A agents
 */

import { v4 as uuidv4 } from "uuid";
import type { Logger } from "../utils/logger.js";
import { createA2AClient, sendToA2AAgent, streamFromA2AAgent, fetchAgentCard } from "../client.js";
import type { A2APluginConfig } from "../types.js";

interface A2AToolContext {
  config: A2APluginConfig;
  logger: Logger;
  getClient: () => Promise<any>;
}

/**
 * Create A2A tools for OpenCode
 */
export function createA2ATools(ctx: A2AToolContext) {
  const { config, logger, getClient } = ctx;

  return {
    /**
     * Send a message to an A2A agent and get a response
     */
    a2a_send: async (input: { message: string; agentUrl?: string }) => {
      const agentUrl = input.agentUrl || config.agentUrl;
      
      if (!agentUrl) {
        return {
          success: false,
          error: "No agent URL configured. Set agentUrl in a2a.jsonc",
        };
      }

      try {
        const client = await getClient();
        const response = await sendToA2AAgent(client, input.message);

        if (response.kind === "message") {
          const text = response.parts
            .filter((p: any) => p.kind === "text")
            .map((p: any) => p.text)
            .join("\n");

          return {
            success: true,
            response: text,
            kind: "message",
          };
        } else if (response.kind === "task") {
          return {
            success: true,
            taskId: response.id,
            status: response.status.state,
            artifacts: response.artifacts?.map((a: any) => ({
              id: a.artifactId,
              parts: a.parts,
            })),
            kind: "task",
          };
        }

        return { success: true, response };
      } catch (error) {
        await logger.log({
          body: {
            service: "a2a-plugin.tools",
            level: "error",
            message: "Failed to send message to A2A agent",
            extra: { error: error instanceof Error ? error.message : "Unknown error" },
          },
        });

        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    /**
     * Stream messages from an A2A agent
     */
    a2a_stream: async function* (input: { message: string; agentUrl?: string }) {
      const agentUrl = input.agentUrl || config.agentUrl;

      if (!agentUrl) {
        yield {
          success: false,
          error: "No agent URL configured",
        };
        return;
      }

      try {
        const client = await getClient();
        const stream = streamFromA2AAgent(client, input.message);

        for await (const event of stream) {
          if (event.kind === "task") {
            yield {
              success: true,
              taskId: event.id,
              status: event.status.state,
              message: event.status.message?.parts?.[0]?.text,
            };
          } else if (event.kind === "status-update") {
            yield {
              success: true,
              type: "status-update",
              taskId: event.taskId,
              status: event.status.state,
              final: event.final,
            };
          } else if (event.kind === "artifact-update") {
            yield {
              success: true,
              type: "artifact-update",
              taskId: event.taskId,
              artifactId: event.artifact?.artifactId,
            };
          }
        }
      } catch (error) {
        yield {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    /**
     * Get agent card from a remote agent
     */
    a2a_discover: async (input: { agentUrl: string }) => {
      try {
        const card = await fetchAgentCard(input.agentUrl);

        return {
          success: true,
          name: card.name,
          description: card.description,
          version: card.version,
          protocolVersion: (card as any).protocolVersion,
          skills: card.skills?.map((s: any) => ({
            id: s.id,
            name: s.name,
            description: s.description,
          })),
          capabilities: {
            streaming: card.capabilities?.streaming,
            pushNotifications: card.capabilities?.pushNotifications,
          },
          url: card.url,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to fetch agent card",
        };
      }
    },

    /**
     * Get task status
     */
    a2a_task_status: async (input: { taskId: string; agentUrl?: string }) => {
      const agentUrl = input.agentUrl || config.agentUrl;

      if (!agentUrl) {
        return { success: false, error: "No agent URL configured" };
      }

      try {
        const client = await getClient();
        const task = await client.getTask({ id: input.taskId });

        return {
          success: true,
          taskId: task.id,
          status: task.status.state,
          message: task.status.message?.parts?.[0]?.text,
          artifacts: task.artifacts?.length || 0,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to get task status",
        };
      }
    },

    /**
     * Cancel a running task
     */
    a2a_cancel: async (input: { taskId: string; agentUrl?: string }) => {
      const agentUrl = input.agentUrl || config.agentUrl;

      if (!agentUrl) {
        return { success: false, error: "No agent URL configured" };
      }

      try {
        const client = await getClient();
        const task = await client.cancelTask(input.taskId);

        return {
          success: true,
          taskId: task.id,
          status: task.status.state,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to cancel task",
        };
      }
    },
  };
}