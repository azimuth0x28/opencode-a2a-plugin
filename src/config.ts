/**
 * A2A Config Loader
 * 
 * Loads configuration from a2a.json or a2a.jsonc file in the OpenCode config directory
 * Supports JSONC format (JSON with Comments)
 */

import { readFile, access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { A2APluginConfig } from "./types.js";

const DEFAULT_CONFIG_DIR = join(homedir(), ".config", "opencode");

/**
 * Strip comments and trailing commas from JSONC content
 * Handles both // and /* * / style comments
 */
function parseJSONC(content: string): Record<string, unknown> {
  let result = "";
  let inString = false;
  let inSingleLineComment = false;
  let inMultiLineComment = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];
    const nextChar = content[i + 1];

    // Handle single-line comments
    if (!inString && !inMultiLineComment && char === "/" && nextChar === "/") {
      inSingleLineComment = true;
      i += 2;
      continue;
    }

    // Handle multi-line comments
    if (!inString && !inSingleLineComment && char === "/" && nextChar === "*") {
      inMultiLineComment = true;
      i += 2;
      continue;
    }

    // End multi-line comment
    if (inMultiLineComment && char === "*" && nextChar === "/") {
      inMultiLineComment = false;
      i += 2;
      continue;
    }

    // Skip content in single-line comment
    if (inSingleLineComment) {
      if (char === "\n") {
        inSingleLineComment = false;
        result += char;
      }
      i++;
      continue;
    }

    // Skip content in multi-line comment
    if (inMultiLineComment) {
      i++;
      continue;
    }

    // Handle string literals
    if (char === '"' && (i === 0 || content[i - 1] !== "\\")) {
      inString = !inString;
    }

    // Handle trailing commas before } or ]
    if (!inString && (char === ",")) {
      const remaining = content.slice(i + 1).trim();
      if (remaining.startsWith("}") || remaining.startsWith("]")) {
        i++;
        continue;
      }
    }

    result += char;
    i++;
  }

  return JSON.parse(result) as Record<string, unknown>;
}

/**
 * Try to find config file - checks both .json and .jsonc extensions
 */
async function findConfigFile(baseDir: string): Promise<string | null> {
  const extensions = [".jsonc", ".json"];
  
  for (const ext of extensions) {
    const path = join(baseDir, `a2a${ext}`);
    try {
      await access(path);
      return path;
    } catch {
      // File doesn't exist, try next extension
    }
  }
  
  return null;
}

/**
 * Load A2A configuration from a2a.json or a2a.jsonc
 * Returns default config if file doesn't exist or is invalid
 */
export async function loadA2AConfig(configPath?: string): Promise<A2APluginConfig> {
  let path: string | undefined = configPath;
  
  // If no explicit path, try to find config file
  if (!path) {
    const found = await findConfigFile(DEFAULT_CONFIG_DIR);
    path = found || undefined;
  }
  
  // If still no path, try default .json
  if (!path) {
    path = join(DEFAULT_CONFIG_DIR, "a2a.json");
  }
  
  try {
    const content = await readFile(path, "utf-8");
    
    // Detect if it's JSONC (has comments) or plain JSON
    const isJSONC = content.includes("//") || content.includes("/*");
    const parsed = isJSONC ? parseJSONC(content) : JSON.parse(content);
    
    // Validate and sanitize configuration
    const config: A2APluginConfig = {};
    
    // String options
    if (typeof parsed.agentUrl === "string") {
      config.agentUrl = parsed.agentUrl;
    }
    if (typeof parsed.agentCardUrl === "string") {
      config.agentCardUrl = parsed.agentCardUrl;
    }
    if (typeof parsed.authToken === "string") {
      config.authToken = parsed.authToken;
    }
    if (typeof parsed.apiKey === "string") {
      config.apiKey = parsed.apiKey;
    }
    if (typeof parsed.serverUrl === "string") {
      config.serverUrl = parsed.serverUrl;
    }
    if (typeof parsed.agentName === "string") {
      config.agentName = parsed.agentName;
    }
    if (typeof parsed.agentDescription === "string") {
      config.agentDescription = parsed.agentDescription;
    }
    
    // Boolean options
    if (typeof parsed.serverMode === "boolean") {
      config.serverMode = parsed.serverMode;
    }
    if (typeof parsed.streaming === "boolean") {
      config.streaming = parsed.streaming;
    }
    if (typeof parsed.pushNotifications === "boolean") {
      config.pushNotifications = parsed.pushNotifications;
    }
    
    // Number options
    if (typeof parsed.port === "number" && parsed.port > 0 && parsed.port < 65536) {
      config.port = parsed.port;
    }
    if (typeof parsed.host === "string") {
      config.host = parsed.host;
    }
    
    return config;
  } catch {
    // Return default config if file doesn't exist
    return {};
  }
}

/**
 * Get default A2A configuration
 */
export function getDefaultConfig(): A2APluginConfig {
  return {
    serverMode: false,
    port: 4000,
    host: "localhost",
    streaming: true,
    pushNotifications: false,
    agentName: "OpenCode Agent",
    agentDescription: "OpenCode AI coding assistant as A2A agent",
  };
}