/**
 * A2A Plugin Types
 * 
 * Type definitions for plugin configuration and state
 */

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

export interface A2AClientState {
  factory: any;
  client?: any;
  agentCard?: any;
}

export interface Logger {
  log(params: { body: { service: string; level: string; message: string; extra?: Record<string, unknown> } }): Promise<void>;
}
