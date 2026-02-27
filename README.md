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
├── index.ts          # Main plugin entry point
├── package.json      # Dependencies
├── README.md         # This file
├── SKILL.md          # OpenCode skill description
└── src/
    ├── types.ts      # TypeScript type definitions
    ├── config.ts     # Config loader (a2a.json/jsonc)
    ├── interceptor.ts # Authentication interceptor
    ├── executor.ts   # Agent executor (server mode)
    ├── server.ts     # A2A server startup
    ├── client.ts     # Client utilities
    ├── tools/        # Custom OpenCode tools
    │   ├── index.ts
    │   └── a2a-tools.ts
    └── utils/        # Utilities
        ├── index.ts
        └── logger.ts # Centralized logging
```

## Installation

```bash
cd ~/.config/opencode/plugins/a2a
npm install
```

## Quick Start

### 1. Configure the Plugin

Configuration is loaded from `~/.config/opencode/a2a.json` or `a2a.jsonc`:

**a2a.json (standard JSON):**
```json
{
  "agentUrl": "http://localhost:4000",
  "authToken": "your-token",
  "serverMode": false,
  "port": 4000
}
```

**a2a.jsonc (JSON with Comments):**
```jsonc
{
  // A2A Agent URL to connect to
  "agentUrl": "http://localhost:4000",
  
  // Authentication token
  "authToken": "your-token",
  
  /* Enable server mode to expose OpenCode as A2A agent */
  "serverMode": false,
  "port": 4000
}
```

The plugin automatically detects `.jsonc` files and parses comments.

### 2. Enable the Plugin

Add to your `opencode.json`:

```json
{
  "plugin": ["./plugins/a2a"]
}
```

### 3. Use as A2A Client

```typescript
import { createA2AClient, sendToA2AAgent } from "./plugins/a2a";

// Connect to an A2A agent
const client = await createA2AClient(
  "http://localhost:4000",
  "your-auth-token"
);

// Send message
const response = await sendToA2AAgent(client, "Hello!");

// Handle response
if (response.kind === "message") {
  console.log(response.parts[0].text);
}
```

### 4. Enable Server Mode

Edit `~/.config/opencode/a2a.json`:

```json
{
  "serverMode": true,
  "port": 4000,
  "agentName": "OpenCode Assistant",
  "agentDescription": "AI coding assistant"
}
```

## Configuration File

The plugin reads configuration from `~/.config/opencode/a2a.json` or `~/.config/opencode/a2a.jsonc`.

### Config File Priority

1. `~/.config/opencode/a2a.jsonc` (if exists)
2. `~/.config/opencode/a2a.json` (fallback)

### Config File Location

| Environment | Path |
|-------------|------|
| Linux/macOS | `~/.config/opencode/a2a.json` or `.jsonc` |
| Custom | Set via `configPath` parameter |

### JSONC Support

The plugin supports JSONC format (JSON with Comments):
- Single-line comments: `// comment`
- Multi-line comments: `/* comment */`
- Trailing commas are automatically handled

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `agentUrl` | string | - | Default A2A agent URL |
| `agentCardUrl` | string | - | Agent Card URL for discovery |
| `authToken` | string | - | Bearer token for auth |
| `apiKey` | string | - | API key for auth |
| `serverMode` | boolean | false | Enable A2A server |
| `port` | number | 4000 | Server port |
| `host` | string | localhost | Server host |
| `serverUrl` | string | - | Public server URL |
| `agentName` | string | OpenCode Agent | Agent name |
| `agentDescription` | string | - | Agent description |
| `streaming` | boolean | true | Enable streaming |
| `pushNotifications` | boolean | false | Enable push notifications |

## Custom Tools

The plugin provides the following OpenCode tools:

| Tool | Description |
|------|-------------|
| `a2a_send` | Send message to A2A agent and get response |
| `a2a_stream` | Stream messages from A2A agent in real-time |
| `a2a_discover` | Fetch and display agent capabilities |
| `a2a_task_status` | Get status of a running task |
| `a2a_cancel` | Cancel a running task |

### Usage Examples

```typescript
// Send message to agent
await a2a_send({ message: "Hello, agent!" })

// Discover agent capabilities
await a2a_discover({ agentUrl: "http://localhost:4000" })

// Get task status
await a2a_task_status({ taskId: "task-123" })

// Cancel task
await a2a_cancel({ taskId: "task-123" })
```

### Custom Commands

The plugin adds these commands to OpenCode:

```json
{
  "a2a-send": "Send message to A2A agent",
  "a2a-discover": "Discover A2A agent capabilities"
}
```

## API Reference

### Client Functions

```typescript
// Create A2A client
createA2AClient(url: string, authToken?: string, apiKey?: string): Promise<A2AClient>

// Send message (blocking)
sendToA2AAgent(client: A2AClient, message: string, sessionId?: string): Promise<Message | Task>

// Stream messages
streamFromA2AAgent(client: A2AClient, message: string, sessionId?: string): AsyncGenerator<Task>

// Fetch agent card
fetchAgentCard(url: string): Promise<AgentCard>
```

### Server Endpoints

When server mode is enabled:

| Endpoint | Description |
|----------|-------------|
| `/.well-known/agent-card.json` | Agent Card (discovery) |
| `/a2a/jsonrpc` | JSON-RPC transport |
| `/a2a/rest` | HTTP+JSON/REST transport |

## A2A Protocol

This plugin implements [A2A Protocol v0.3.0](https://a2a-protocol.org/v0.3.0/specification/).

### Key Concepts

- **Agent Card** - JSON metadata describing agent capabilities
- **Task** - Stateful unit of work with lifecycle (submitted → working → completed)
- **Message** - Communication between client and agent
- **Part** - Content unit (text, file, data)
- **Artifact** - Output generated by agent

### Exposed Skills (Server Mode)

| Skill ID | Name | Description |
|----------|------|-------------|
| `code-assistance` | Code Assistance | Help with coding tasks |
| `code-review` | Code Review | Review code for issues |
| `refactoring` | Refactoring | Refactor code |

## Dependencies

- `@a2a-js/sdk` - Official A2A JavaScript SDK
- `express` - HTTP server (server mode)
- `uuid` - UUID generation

## License

MIT
