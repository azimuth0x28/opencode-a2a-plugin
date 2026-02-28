# A2A Protocol Plugin for OpenCode

A2A (Agent-to-Agent) Protocol plugin that enables OpenCode to communicate with A2A-compatible agents and optionally expose OpenCode as an A2A server.

## Overview

This plugin integrates the official [A2A Protocol](https://a2a-protocol.org) (v0.3.0) into OpenCode, allowing:

- **Connect to external A2A agents** - Query other A2A-compatible agents for specialized tasks
- **Expose OpenCode as A2A server** - Make OpenCode available as an A2A agent for other systems
- **Agent discovery** - Fetch and parse Agent Cards from remote agents
- **Streaming responses** - Real-time streaming of agent responses via SSE
- **Authentication** - Support for Bearer tokens and API keys

## Project Structure

```
a2a/
├── index.ts              # Main plugin entry point
├── package.json          # Dependencies
├── README.md             # This file
├── SKILL.md              # OpenCode skill description
├── server.mjs            # Standalone server (optional)
├── tsconfig.json         # TypeScript config
└── src/
    ├── types.ts          # TypeScript type definitions
    ├── config.ts         # Config loader (a2a.json/jsonc)
    ├── interceptor.ts    # Authentication interceptor
    ├── executor.ts       # Agent executor (server mode)
    ├── server.ts         # A2A server startup
    ├── client.ts         # Client utilities
    ├── tools/            # Custom OpenCode tools
    │   ├── index.ts
    │   └── a2a-tools.ts  # a2a_send, a2a_discover, a2a_task_status, a2a_cancel
    └── utils/            # Utilities
        ├── index.ts
        └── logger.ts     # Centralized logging
```

## Installation

```bash
cd ~/.config/opencode/plugin/a2a
npm install
npm run build
```

## Quick Start

### 1. Configure the Plugin

Configuration is loaded from `~/.config/opencode/a2a.json` or `a2a.jsonc`:

**a2a.jsonc (JSON with Comments):**
```jsonc
{
  // A2A Agent URL to connect to
  "agentUrl": "http://localhost:4000",
  
  // Authentication token
  "authToken": "",
  
  // Enable server mode to expose OpenCode as A2A agent
  "serverMode": true,
  
  // Server configuration
  "port": 4000,
  "host": "localhost",
  
  // Agent identity (used in server mode)
  "agentName": "OpenCode Agent",
  "agentDescription": "OpenCode AI coding assistant as A2A agent",
  
  // Features
  "streaming": true,
  "pushNotifications": false
}
```

### 2. Enable the Plugin

Add to your `opencode.jsonc`:

```jsonc
{
  "plugin": [
    "./plugin/a2a"
  ]
}
```

### 3. Use as A2A Client (Tools)

The plugin provides 4 OpenCode tools:

| Tool | Description |
|------|-------------|
| `a2a_send` | Send message to A2A agent and get response |
| `a2a_discover` | Fetch and display agent capabilities from Agent Card |
| `a2a_task_status` | Get status of a running task |
| `a2a_cancel` | Cancel a running task |

**Usage:**

```
# Send message to A2A agent
a2a_send message: "Hello, help me with this code..."

# Discover agent capabilities
a2a_discover agentUrl: "http://localhost:4000"

# Get task status
a2a_task_status taskId: "task-123"

# Cancel task
a2a_cancel taskId: "task-123"
```

### 4. Enable Server Mode

Set `serverMode: true` in config:

```jsonc
{
  "serverMode": true,
  "port": 4000,
  "agentName": "OpenCode Assistant",
  "agentDescription": "AI coding assistant"
}
```

## Server Endpoints

When server mode is enabled, the following endpoints are available:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/agent-card.json` | GET | Agent Card (discovery) |
| `/a2a/jsonrpc` | POST | JSON-RPC transport |
| `/a2a/rest` | POST | HTTP+JSON/REST transport |

### JSON-RPC Methods

| Method | Description |
|--------|-------------|
| `message/send` | Send message, returns Message or Task |
| `tasks/get` | Get task by ID |
| `tasks/cancel` | Cancel a running task |
| `tasks/pushNotificationConfig/*` | Push notification management |

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/card` | GET | Get Agent Card |
| `/v1/messages:send` | POST | Send message |
| `/v1/messages:stream` | POST | Stream messages |
| `/v1/tasks/:id` | GET | Get task |
| `/v1/tasks/:id:cancel` | POST | Cancel task |

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `agentUrl` | string | - | Default A2A agent URL |
| `agentCardUrl` | string | - | Agent Card URL for discovery |
| `authToken` | string | - | Bearer token for auth |
| `apiKey` | string | - | API key for auth |
| `serverMode` | boolean | false | Enable A2A server |
| `port` | number | 4000 | Server port (1-65535) |
| `host` | string | localhost | Server host |
| `serverUrl` | string | - | Public server URL |
| `agentName` | string | OpenCode Agent | Agent name |
| `agentDescription` | string | - | Agent description |
| `streaming` | boolean | true | Enable streaming |
| `pushNotifications` | boolean | false | Enable push notifications |

## Standalone Server

You can also run the A2A server as a standalone process (without OpenCode):

```bash
cd plugin/a2a
node server.mjs
```

Or with environment variables:

```bash
A2A_PORT=4001 A2A_HOST=0.0.0.0 A2A_AGENT_NAME="My Agent" node server.mjs
```

## API Reference

### Client Functions

```typescript
// Create A2A client
createA2AClient(url: string, authToken?: string, apiKey?: string): Promise<A2AClient>

// Send message (blocking)
sendToA2AAgent(client: A2AClient, message: string, sessionId?: string): Promise<Message | Task>

// Stream messages
streamFromA2AAgent(client: A2AClient, message: string, sessionId?: string): AsyncGenerator<A2AMessage>

// Fetch agent card
fetchAgentCard(url: string): Promise<AgentCard>
```

### Exposed Skills (Server Mode)

| Skill ID | Name | Description |
|----------|------|-------------|
| `code-assistance` | Code Assistance | Help with coding tasks |
| `code-review` | Code Review | Review code for issues |
| `refactoring` | Refactoring | Refactor code |

## A2A Protocol

This plugin implements [A2A Protocol v0.3.0](https://a2a-protocol.org/v0.3.0/specification/).

### Key Concepts

- **Agent Card** - JSON metadata describing agent capabilities
- **Task** - Stateful unit of work with lifecycle (submitted → working → completed)
- **Message** - Communication between client and agent
- **Part** - Content unit (text, file, data)
- **Artifact** - Output generated by agent

## Dependencies

- `@a2a-js/sdk` - Official A2A JavaScript SDK (v0.3.10)
- `express` - HTTP server (server mode)
- `uuid` - UUID generation

## Security Features

- URL sanitization (credentials removed from logs)
- Authentication interceptor for outbound requests
- Warning when server runs without authentication
- Input validation for URLs (HTTP/HTTPS only)

## Error Handling

- Config loading: Logs warning when falling back to defaults
- Server start: Handles EADDRINUSE, EACCES errors
- Polling: Exponential backoff with error logging
- Client: Network timeout (10s) with proper error messages

## License

MIT