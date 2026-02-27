/**
 * OpenCode Agent Executor
 * 
 * Handles A2A task execution for server mode
 * Uses OpenCode client SDK directly instead of spawning subprocess
 */

import {
  RequestContext,
  ExecutionEventBus,
} from "@a2a-js/sdk/server";
import { v4 as uuidv4 } from "uuid";
import type { Logger } from "./types.js";

// Type for OpenCode client SDK
interface OpenCodeClient {
  session: {
    create: (params: { body: { title?: string; parentID?: string } }) => Promise<{ data?: { id: string } }>;
    prompt: (params: { path: { id: string }; body: { parts: Array<{ type: string; text: string }>; agent?: string } }) => Promise<any>;
    messages: (params: { path: { id: string } }) => Promise<{ data?: Array<{ info: { role: string }; parts: Array<{ type: string; text: string }> }> }>;
    delete: (params: { path: { id: string } }) => Promise<any>;
  };
}

export class OpenCodeAgentExecutor {
  private logger?: Logger;
  private client?: OpenCodeClient;
  private timeout: number;

  constructor(client?: OpenCodeClient, logger?: Logger, options?: { timeout?: number }) {
    this.client = client;
    this.logger = logger;
    this.timeout = options?.timeout || 120000; // 2 minutes default
  }

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const { taskId, contextId, userMessage, task } = requestContext;

    // Get user message text
    const textPart = userMessage.parts.find((p: any) => p.kind === "text") as any;
    const userText = textPart?.text || "";

    // 1. Publish initial Task event (if new task)
    // This is REQUIRED for the SDK to track the task properly
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

    // 2. Publish "working" status update with message
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
          parts: [{ kind: "text", text: "Processing your request with OpenCode..." }],
          taskId,
          contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: false,
    });

    try {
      // Process with OpenCode - return real response via artifact
      const response = await this.processWithOpenCode(userText);

      // 3. Publish artifact with the result
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

      // 4. Publish final status (completed)
      // DO NOT call eventBus.finished() - SDK handles it automatically!
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
      
    } catch (error) {
      // Publish error status
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
      
      // DO NOT call eventBus.finished() here either!
    }
  }

  async cancelTask(taskId: string, eventBus: ExecutionEventBus): Promise<void> {
    // Publish cancelled status
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
    
    // DO NOT call eventBus.finished() - SDK handles it
    
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
      throw new Error("OpenCode client not available. Please configure the A2A plugin properly.");
    }

    const startTime = Date.now();

    try {
      // 1. Create a new session for this task
      const sessionResult = await this.client.session.create({
        body: {
          title: `A2A Task: ${prompt.slice(0, 50)}...`,
        },
      });

      if (!sessionResult.data?.id) {
        throw new Error("Failed to create OpenCode session");
      }

      const sessionId = sessionResult.data.id;

      // 2. Send the prompt to the session
      await this.client.session.prompt({
        path: { id: sessionId },
        body: {
          parts: [{ type: "text", text: prompt }],
        },
      });

      // 3. Wait for completion (poll for idle or timeout)
      const pollInterval = 1000;
      const maxPolls = Math.ceil(this.timeout / pollInterval);
      let polls = 0;

      while (polls < maxPolls) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        polls++;

        // Check if session is still running by trying to get messages
        // If we can get messages and there's an assistant response, we're done
        try {
          const messagesResult = await this.client.session.messages({
            path: { id: sessionId },
          });

          const messages = messagesResult.data || [];
          
          // Find the last assistant message
          const assistantMessages = messages.filter(
            (m: any) => m.info?.role === "assistant"
          );

          if (assistantMessages.length > 0) {
            // Get the last assistant message's text parts
            const lastAssistant = assistantMessages[assistantMessages.length - 1];
            const textParts = lastAssistant.parts?.filter((p: any) => p.type === "text") || [];
            
            if (textParts.length > 0) {
              const response = textParts.map((p: any) => p.text).join("\n");
              const elapsed = Date.now() - startTime;
              
              // Clean up the session
              try {
                await this.client.session.delete({ path: { id: sessionId } });
              } catch {
                // Ignore cleanup errors
              }

              return response || `OpenCode processed your request (${elapsed}ms)`;
            }
          }
        } catch {
          // Session might have been deleted or errored, continue polling
        }
      }

      // Timeout reached - try to get whatever we have
      try {
        const messagesResult = await this.client.session.messages({
          path: { id: sessionId },
        });
        const messages = messagesResult.data || [];
        const assistantMessages = messages.filter((m: any) => m.info?.role === "assistant");
        
        if (assistantMessages.length > 0) {
          const lastAssistant = assistantMessages[assistantMessages.length - 1];
          const textParts = lastAssistant.parts?.filter((p: any) => p.type === "text") || [];
          if (textParts.length > 0) {
            return textParts.map((p: any) => p.text).join("\n");
          }
        }
      } catch {
        // Ignore
      }

      throw new Error(`OpenCode timeout after ${this.timeout}ms`);

    } catch (error) {
      if (error instanceof Error && error.message.includes("timeout")) {
        throw error;
      }
      throw new Error(`OpenCode execution failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}