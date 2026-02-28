/**
 * A2A Plugin Types
 *
 * Type definitions for plugin configuration and state
 * NOTE: Most types are imported from @a2a-js/sdk - see AGENTS.md
 * Only define types here that are NOT in the SDK
 */

import type { ClientFactory, Client } from "@a2a-js/sdk/client";
import type { Task, AgentCard } from "@a2a-js/sdk";

// =============================================================================
// PLUGIN-SPECIFIC TYPES (Not in SDK)
// =============================================================================

/** A2A Plugin configuration */
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

// =============================================================================
// LIST TASKS (Section 3.1.4 of A2A Spec - NOT in SDK)
// =============================================================================

/** List tasks request parameters */
export interface ListTasksRequest {
	/** Filter by context ID */
	contextId?: string;
	/** Filter by task status */
	status?: string[];
	/** Number of items per page */
	limit?: number;
	/** Page token for pagination */
	pageToken?: string;
	/** Include artifacts in the response */
	includeArtifacts?: boolean;
}

/** List tasks response */
export interface ListTasksResponse {
	/** List of tasks */
	tasks: Task[];
	/** Token for the next page */
	nextPageToken: string;
}

// =============================================================================
// PUSH NOTIFICATION REQUEST TYPES (Section 3.1.7-3.1.10 of A2A Spec)
// =============================================================================

/** Create push notification configuration request */
export interface CreatePushNotificationConfigRequest {
	taskId: string;
	url: string;
	name?: string;
	authentication?: {
		schemes?: string[];
		credentials?: string;
	};
}

/** Get push notification configuration request */
export interface GetPushNotificationConfigRequest {
	taskId: string;
	id: string;
}

/** Delete push notification configuration request */
export interface DeletePushNotificationConfigRequest {
	taskId: string;
	id: string;
}

// =============================================================================
// PLUGIN STATE TYPES
// =============================================================================

// Client is already imported from @a2a-js/sdk/client at line 9

/** A2A client state */
export interface A2AClientState {
	factory: ClientFactory;
	client?: A2AClient;
	agentCard?: AgentCard;
}

/** Type for A2A client (from SDK) */
export type A2AClient = Client;

/** Logger interface */
export interface Logger {
	log(params: {
		body: {
			service: string;
			level: string;
			message: string;
			extra?: Record<string, unknown>;
		};
	}): Promise<void>;
}

// =============================================================================
// RE-EXPORT COMMON SDK TYPES FOR CONVENIENCE
// =============================================================================

// These are re-exported for convenience so other files can import from here
// instead of directly from @a2a-js/sdk
export type { Task, AgentCard } from "@a2a-js/sdk";
