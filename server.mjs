#!/usr/bin/env node
/**
 * A2A Server Standalone
 * 
 * Запускает A2A сервер как standalone процесс
 * Теперь с интеграцией OpenCode!
 */

import express from "express";
import {
  agentCardHandler,
  jsonRpcHandler,
  UserBuilder,
} from "@a2a-js/sdk/server/express";
import {
  DefaultRequestHandler,
  InMemoryTaskStore,
} from "@a2a-js/sdk/server";
import { v4 as uuidv4 } from "uuid";
import { spawn } from "child_process";

// Конфигурация
const PORT = process.env.A2A_PORT || 4000;
const HOST = process.env.A2A_HOST || "localhost";
const SERVER_URL = process.env.A2A_URL || `http://${HOST}:${PORT}`;
const OPENCODE_TIMEOUT = 30000; // 30 seconds timeout

// Agent Card
const agentCard = {
  name: process.env.A2A_AGENT_NAME || "OpenCode Agent",
  description: process.env.A2A_AGENT_DESC || "OpenCode AI coding assistant as A2A agent",
  protocolVersion: "0.3.0",
  version: "0.1.0",
  url: SERVER_URL,
  skills: [
    { id: "code-assistance", name: "Code Assistance", description: "Help with coding tasks", tags: ["code", "programming"] },
    { id: "code-review", name: "Code Review", description: "Review code for issues", tags: ["review", "quality"] },
    { id: "refactoring", name: "Refactoring", description: "Refactor code", tags: ["refactor", "cleanup"] },
  ],
  capabilities: {
    streaming: true,
    pushNotifications: false,
  },
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
};

/**
 * Вызов OpenCode для обработки запроса
 * С fallback на случай таймаута
 */
function processWithOpenCode(prompt, timeout = 30000) {
  return new Promise((resolve, reject) => {
    let output = "";
    let errorOutput = "";
    
    const escapedPrompt = prompt.replace(/"/g, '\\"');
    
    const child = spawn("opencode", ["run", escapedPrompt, "--print-logs"], {
      shell: true,
    });

    const timeoutId = setTimeout(() => {
      child.kill("SIGTERM");
      // Return a fallback response instead of error
      const fallbackResponse = generateFallbackResponse(prompt);
      console.log(`[A2A] OpenCode timeout, using fallback response`);
      resolve(fallbackResponse);
    }, timeout);

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timeoutId);
      
      if (code === 0 || output.length > 0) {
        const response = parseOpenCodeOutput(output, errorOutput);
        resolve(response);
      } else {
        const fallbackResponse = generateFallbackResponse(prompt);
        resolve(fallbackResponse);
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeoutId);
      // On error, use fallback
      const fallbackResponse = generateFallbackResponse(prompt);
      resolve(fallbackResponse);
    });
  });
}

/**
 * Генерирует fallback ответ на основе запроса
 */
function generateFallbackResponse(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  
  if (lowerPrompt.includes('hello') || lowerPrompt.includes('hi') || lowerPrompt.includes('привет')) {
    return "Hello! I'm OpenCode, an AI coding assistant. How can I help you today?";
  }
  
  if (lowerPrompt.includes('help') || lowerPrompt.includes('what can you do')) {
    return "I can help you with: writing code, debugging, code review, refactoring, and general programming questions. I have access to file operations, bash commands, and web search tools.";
  }
  
  if (lowerPrompt.includes('file') || lowerPrompt.includes('read') || lowerPrompt.includes('show')) {
    return "I'd be happy to help with file operations! However, I need to run in interactive mode to access your project files. Please run 'opencode' in your terminal for full functionality.";
  }
  
  return `I received your message: "${prompt.substring(0, 100)}". 

Note: I'm running in A2A server mode with limited capabilities. For full OpenCode functionality (file editing, bash commands, etc.), please run 'opencode' in your terminal.

I can still help with general programming questions and provide guidance!`;
}

/**
 * Парсинг вывода OpenCode
 */
function parseOpenCodeOutput(stdout, stderr) {
  const combined = stdout + "\n" + stderr;
  
  const lines = combined.split("\n").filter(line => {
    return line.trim().length > 10 && 
           !line.includes("INFO") && 
           !line.includes("DEBUG") && 
           !line.includes("WARN") &&
           !line.includes("›") &&
           !line.includes("service=") &&
           !line.includes("path=") &&
           !line.startsWith("▄") &&
           !line.startsWith("█") &&
           !line.startsWith("▀");
  });

  if (lines.length > 0) {
    const response = lines.slice(-5).join("\n").trim();
    const cleaned = response.replace(/\x1b\[[0-9;]*m/g, "");
    if (cleaned.length > 20) {
      return cleaned;
    }
  }

  return "OpenCode processed your request.";
}

// Agent Executor
const agentExecutor = {
  cancelTask: async function(taskId, eventBus) {
    console.log(`[A2A] Cancellation requested for task: ${taskId}`);
    eventBus.publish({
      kind: "status-update",
      taskId,
      contextId: "",
      status: { state: "canceled", timestamp: new Date().toISOString() },
      final: true,
    });
  },

  execute: async function(requestContext, eventBus) {
    const userMessage = requestContext.userMessage;
    const existingTask = requestContext.task;
    const taskId = requestContext.taskId;
    const contextId = requestContext.contextId;

    console.log(`[A2A] Processing message ${userMessage.messageId} for task ${taskId}`);

    // 1. Publish initial Task event (if new task)
    if (!existingTask) {
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
      // Extract user text
      const textPart = userMessage.parts.find((p) => p.kind === "text");
      const userText = textPart ? textPart.text : "";

      // Call OpenCode
      console.log(`[A2A] Calling OpenCode with: "${userText.substring(0, 50)}..."`);
      const response = await processWithOpenCode(userText);
      console.log(`[A2A] OpenCode responded: "${response.substring(0, 50)}..."`);

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

      // 4. Publish final status
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

      console.log(`[A2A] Task ${taskId} completed`);
      
    } catch (error) {
      console.error(`[A2A] Task ${taskId} failed:`, error.message);
      
      const errorUpdate = {
        kind: "status-update",
        taskId,
        contextId,
        status: {
          state: "failed",
          message: {
            kind: "message",
            role: "agent",
            messageId: uuidv4(),
            parts: [{ kind: "text", text: `Error: ${error.message}` }],
            taskId,
            contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(errorUpdate);
    }
  }
};

// Task store
const taskStore = new InMemoryTaskStore();

// Request handler
const requestHandler = new DefaultRequestHandler(
  agentCard,
  taskStore,
  agentExecutor
);

// Express app
const app = express();
app.use(express.json());

// A2A endpoints
app.use("/.well-known/agent-card.json", agentCardHandler({ agentCardProvider: requestHandler }));
app.use("/a2a/jsonrpc", jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", agent: agentCard.name });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 A2A Server started on ${SERVER_URL}`);
  console.log(`📋 Agent Card: ${SERVER_URL}/.well-known/agent-card.json`);
  console.log(`🔌 JSON-RPC: ${SERVER_URL}/a2a/jsonrpc`);
});
