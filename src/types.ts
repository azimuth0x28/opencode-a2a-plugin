/**
 * A2A Plugin Types
 * 
 * Type definitions for plugin configuration and state
 */

import type { ClientFactory } from "@a2a-js/sdk/client";

export interface A2APluginConfig {
  /** Default A2A agent URL */
  agentUrl?: string;
  
  /** Agent Card URL for discovery */
  agentCardUrl?: string;
  
  /** Authentication token */
  authToken?: string;
  
  /** API Key */
  apiKey?: string;
  
  /** Enable server mode */
  serverMode?: boolean;
  
  /** Server port */
  port?: number;
  
  /** Server host */
  host?: string;
  
  /** A2A Server URL (for other agents to connect) */
  serverUrl?: string;
  
  /** Agent name */
  agentName?: string;
  
  /** Agent description */
  agentDescription?: string;
  
  /** Enable streaming */
  streaming?: boolean;
  
  /** Push notifications enabled */
  pushNotifications?: boolean;
}

// A2A Message Part types
export interface TextPart {
  kind: "text";
  text: string;
}

export interface FilePart {
  kind: "file";
  file: {
    mimeType: string;
    bytes?: string;
    uri?: string;
  };
}

export type MessagePart = TextPart | FilePart;

// A2A Message types
export interface A2AMessage {
  kind: "message";
  messageId: string;
  role: "user" | "agent";
  parts: MessagePart[];
  sessionId?: string;
}

// A2A Task Status types
export type TaskStatusState = 
  | "submitted"
  | "working"
  | "completed"
  | "canceled"
  | "failed"
  | "input-required";

export interface TaskStatus {
  state: TaskStatusState;
  message?: A2AMessage;
  timestamp?: string;
}

// A2A Task types
export interface A2ATask {
  id: string;
  contextId?: string;
  status: TaskStatus;
  history?: A2AMessage[];
  artifacts?: TaskArtifact[];
}

export interface TaskArtifact {
  artifactId: string;
  name?: string;
  description?: string;
  parts: MessagePart[];
}

// A2A Agent Card types
export interface AgentCapabilities {
  streaming: boolean;
  pushNotifications: boolean;
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags?: string[];
}

export interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  protocolVersion?: string;
  capabilities?: AgentCapabilities;
  skills?: AgentSkill[];
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
  additionalInterfaces?: Array<{ url: string; transport: string }>;
}

export interface A2AClientState {
  factory: ClientFactory;
  client?: A2AClient;
  agentCard?: AgentCard;
}

// Type for A2A client (from SDK)
export type A2AClient = any;

export interface Logger {
  log(params: { body: { service: string; level: string; message: string; extra?: Record<string, unknown> } }): Promise<void>;
}
