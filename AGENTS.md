# AGENTS.md — A2A Plugin Development Guide

Onboarding guide for AI agents developing or extending the A2A Protocol plugin for OpenCode.

---

## Quick Start

This plugin provides OpenCode tools for interacting with A2A (Agent-to-Agent) protocol agents. All communication goes through the `@a2a-js/sdk` package.

**Key principle**: Use SDK types and methods. Do not duplicate.

---

## Architecture

```
a2a/
├── index.ts              # Plugin entry point, registers tools
├── src/
│   ├── types.ts          # Plugin-specific types only (minimal)
│   ├── client.ts         # SDK wrapper functions
│   ├── config.ts         # Configuration loader
│   ├── interceptor.ts    # Auth token handling
│   └── tools/
│       └── a2a-tools.ts  # OpenCode tool definitions
└── node_modules/@a2a-js/sdk/  # Official SDK (always use this)
```

---

## SDK Types — Always Use These

Import all types from `@a2a-js/sdk`. Do NOT define custom types for SDK entities.

```typescript
import type {
  Task,
  Artifact,
  Message,
  Part,
  AgentCard,
  Client,
  TaskPushNotificationConfig,
  TaskState
} from "@a2a-js/sdk";
```

### When You Need Custom Types

Only define types for functionality NOT in SDK:

| Custom Type | Purpose |
|-------------|---------|
| `ListTasksRequest/Response` | SDK doesn't have listTasks endpoint |
| `CreatePushNotificationConfigRequest` | Request params for push config |
| `GetPushNotificationConfigRequest` | Request params for getting push config |
| `DeletePushNotificationConfigRequest` | Request params for deleting push config |
| `A2APluginConfig` | Plugin configuration |
| `A2AClientState` | Plugin internal state |

---

## SDK Methods — Correct Names

Always use these exact SDK method names:

| Operation | SDK Method |
|-----------|------------|
| Send message | `client.sendMessage(params)` |
| Streaming | `client.sendMessageStream(params)` |
| Get task | `client.getTask(params)` |
| Cancel task | `client.cancelTask(params)` |
| Subscribe | `client.resubscribeTask(params)` |
| Create push | `client.setTaskPushNotificationConfig(params)` |
| Get push | `client.getTaskPushNotificationConfig(params)` |
| List push | `client.listTaskPushNotificationConfig(params)` |
| Delete push | `client.deleteTaskPushNotificationConfig(params)` |
| Get agent card | `fetchAgentCard(url)` or `client.getAgentCard({})` |

---

## Available Tools

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `a2a_send` | Send message to agent | `message`, `blocking?` |
| `a2a_stream` | Streaming response | `message` |
| `a2a_discover` | Get agent capabilities | — |
| `a2a_task_status` | Get task with artifacts | `taskId`, `includeHistory?` |
| `a2a_cancel` | Cancel running task | `taskId` |
| `a2a_list_tasks` | List tasks | `contextId?`, `status?`, `limit?` |
| `a2a_subscribe` | Real-time task updates | `taskId` |
| `a2a_create_push` | Create webhook | `taskId`, `url` |
| `a2a_get_push` | Get push config | `taskId`, `configId` |
| `a2a_list_push` | List push configs | `taskId` |
| `a2a_delete_push` | Delete push config | `taskId`, `configId` |
| `a2a_extended_card` | Extended agent card | — |

---

## Correct Patterns

### Client Type for Functions

```typescript
import type { Client } from "@a2a-js/sdk";

export async function sendToA2AAgent(
  client: Client,  // Always use Client type
  message: string
): Promise<...> { ... }
```

### Sending Message with Blocking

```typescript
const response = await sendToA2AAgent(client, message, sessionId, true);

if (response.kind === "message") {
  // Immediate response
  return formatParts(response.parts);
} else if (response.kind === "task") {
  // Async task - fetch result
  const task = await client.getTask({ id: response.id });
  return formatTask(task);
}
```

### Formatting Artifacts

```typescript
function formatArtifacts(artifacts: Artifact[]): string {
  let output = "";
  for (const artifact of artifacts) {
    output += `## ${artifact.name || artifact.artifactId}\n`;
    for (const part of artifact.parts) {
      if (part.kind === "text") {
        output += part.text + "\n";
      }
    }
  }
  return output;
}
```

### Auth Interceptor Setup

```typescript
const interceptor = new AuthInterceptor(token, apiKey);
const factory = new ClientFactory(
  ClientFactoryOptions.createFrom(ClientFactoryOptions.default, {
    clientConfig: { interceptors: [interceptor] }
  })
);
const client = await factory.createFromUrl(agentUrl);
```

### Streaming Response

```typescript
const stream = client.sendMessageStream({
  message: {
    kind: "message",
    messageId: crypto.randomUUID(),
    role: "user",
    parts: [{ kind: "text", text: message }]
  }
});

for await (const event of stream) {
  if (event.kind === "statusUpdate") {
    console.log(event.status.state);
  } else if (event.kind === "artifactUpdate") {
    console.log(event.artifact);
  } else if (event.kind === "message") {
    console.log(event.parts);
  }
}
```

---

## Task States

```
submitted → working → completed
                ↓
           input-required
                ↓
           canceled | failed | rejected | auth-required
```

---

## Common Mistakes to Avoid

1. **Don't define types that exist in SDK** — Import from `@a2a-js/sdk`

2. **Don't use `any` for client** — Use `Client` type from SDK

3. **Don't forget `blocking: true`** — Or fetch task after creation to get results

4. **Don't return only artifact count** — Format and include actual content

5. **Don't use wrong method names** — Use `setTaskPushNotificationConfig`, not `create...`

6. **Don't create factory after interceptor** — Configure factory with interceptor first

---

## File Reference

| File | Purpose |
|------|---------|
| `src/types.ts` | Plugin types only (SDK types imported elsewhere) |
| `src/client.ts` | SDK wrapper functions |
| `src/tools/a2a-tools.ts` | Tool definitions |
| `index.ts` | Plugin registration |

---

## SDK TypeScript Definitions

The `@a2a-js/sdk` package has multiple entry points with different type definitions:

### Available .d.ts Files

| Path | Purpose |
|------|---------|
| `dist/index.d.ts` | Main entry, re-exports from extensions |
| `dist/core-BAzQJfA2.d.ts` | Client implementation, A2AClient class |
| `dist/extensions-DvruCIzw.d.ts` | Protocol types (Task, Message, Artifact, etc.) |
| `dist/client/index.d.ts` | Client factory, authentication handlers |
| `dist/server/index.d.ts` | Server-side types |

### What Each Exports

**`@a2a-js/sdk`** (index.d.ts)
- Response types: `SendMessageResponse`, `GetTaskResponse`, `CancelTaskResponse`, etc.
- Constants: `AGENT_CARD_PATH`, `HTTP_EXTENSION_HEADER`
- Error types: `A2AError`, `JSONRPCError`

**`@a2a-js/sdk/client`** (client/index.d.ts)
- `ClientFactory` — Create clients
- `ClientFactoryOptions` — Configure factory
- `Client` — Main client interface
- `A2AClient` — Deprecated client class
- `AuthenticationHandler` — Custom auth logic

**`@a2a-js/sdk`** (extensions-DvruCIzw.d.ts)
- `Task`, `TaskStatus`, `TaskState`
- `Message`, `Part` (TextPart, FilePart, DataPart)
- `Artifact`
- `AgentCard`, `AgentCapabilities`, `AgentSkill`
- `TaskPushNotificationConfig`
- All request/response types

### Import Examples[AgenticTeamModels.md](../../AgenticTeamModels.md)

```typescript
// Most common - protocol types
import type { Task, Message, Part, Artifact, AgentCard } from "@a2a-js/sdk";

// Client factory and options
import { ClientFactory, ClientFactoryOptions } from "@a2a-js/sdk/client";
import type { Client } from "@a2a-js/sdk";

// Response types
import type { SendMessageResponse, GetTaskResponse } from "@a2a-js/sdk";

// Constants
import { AGENT_CARD_PATH } from "@a2a-js/sdk";
```

---

## References

- **A2A Spec**: https://github.com/a2aproject/A2A/blob/main/docs/specification.md
- **SDK**: `@a2a-js/sdk` (v0.3.10)