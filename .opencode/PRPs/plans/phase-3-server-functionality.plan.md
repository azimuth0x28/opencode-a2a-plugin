# Feature: Phase 3 - Серверный функционал

## Summary

Реализация серверного режима: Express сервер с A2A эндпоинтами, обработка задач через executor, Agent Card, JSON-RPC и REST методы, health checks, Prometheus metrics.

## User Story

As a AI-инженер
I want предоставить OpenCode как A2A-агент
So that другие системы могут взаимодействовать со мной через A2A протокол

## Problem Statement

Нет возможности предоставить OpenCode как A2A-агент. Внешние системы не могут отправлять сообщения в OpenCode через A2A протокол.

## Solution Statement

Создать:
- src/server.ts — Express сервер с A2A эндпоинтами
- src/executor.ts — обработка задач через OpenCode session API
- Health check эндпоинты (/health, /health/ready, /health/live)
- Prometheus metrics

## Metadata

| Field            | Value                                             |
| ---------------- | ------------------------------------------------- |
| Type             | NEW_CAPABILITY                                    |
| Complexity       | MEDIUM                                           |
| Systems Affected | src/server.ts, src/executor.ts, server.mjs       |
| Dependencies     | express ^4.19.0, prom-client ^15.1.0             |
| Estimated Tasks  | 5                                                 |

---

## UX Design

### Before State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BEFORE STATE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Внешние системы                                                           │
│        │                                                                    │
│        ▼                                                                    │
│   Нет доступа к OpenCode через A2A                                         │
│                                                                             │
│   USER_FLOW: Невозможно предоставить OpenCode как A2A агент                │
│   PAIN_POINT: Закрытая система без стандартизированного API                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### After State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AFTER STATE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Внешние системы                                                           │
│        │                                                                    │
│        ▼                                                                    │
│   ┌─────────────────────────────────────┐                                   │
│   │  A2A Server (Express)               │                                   │
│   │  • /.well-known/agent-card.json     │                                   │
│   │  • /a2a/jsonrpc                     │                                   │
│   │  • /a2a/rest                        │                                   │
│   │  • /health, /metrics                │                                   │
│   └─────────────────────────────────────┘                                   │
│        │                                                                    │
│        ▼                                                                    │
│   ┌─────────────────────────────────────┐                                   │
│   │  OpenCodeAgentExecutor              │                                   │
│   │  • Создание сессии                  │                                   │
│   │  • Отправка prompt                  │                                   │
│   │  • Получение ответов                │                                   │
│   └─────────────────────────────────────┘                                   │
│                                                                             │
│   VALUE_ADD: OpenCode доступен как A2A агент                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|---------------|
| P0 | `src/types.ts` | all | Types to IMPORT |
| P1 | `src/client.ts` | 1-30 | SDK wrapper patterns |
| P2 | `index.ts` | 124-127 | Как запускать сервер |

**External Documentation:**
| Source | Section | Why Needed |
|--------|---------|------------|
| [A2A Protocol Spec](https://a2a-protocol.org/v0.3.0/specification) | Server endpoints | Какие эндпоинты нужны |
| [Express.js](https://expressjs.com/) | Getting started | Настройка сервера |
| [prom-client](https://www.npmjs.com/package/prom-client) | Metrics | Prometheus metrics |

---

## Patterns to Mirror

**EXPRESS_SERVER_PATTERN:**
```typescript
// SOURCE: src/server.ts (to be created)
// PATTERN TO FOLLOW:
import express from "express";
import { jsonRpcHandler, restHandler, DefaultRequestHandler } from "@a2a-js/sdk/server/express";

const app = express();
app.use(express.json());

// Agent Card endpoint
app.get("/.well-known/agent-card.json", (req, res) => {
  res.json(agentCard);
});

// JSON-RPC
app.post("/a2a/jsonrpc", jsonRpcHandler(...));

// REST
app.post("/message:send", restHandler(...));
```

**EXECUTOR_PATTERN:**
```typescript
// SOURCE: src/executor.ts (to be created)
// PATTERN TO FOLLOW:
export class OpenCodeAgentExecutor {
  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    // Extract message
    const textPart = userMessage.parts.find((p) => p.kind === "text");
    const userText = textPart?.text || "";
    
    // Process with OpenCode
    const response = await this.processWithOpenCode(userText);
    
    // Publish result
    this.publishSuccess(eventBus, taskId, contextId, response);
  }
}
```

---

## Files to Change

| File                  | Action | Justification                                    |
| --------------------- | ------ | ------------------------------------------------ |
| `src/executor.ts`     | CREATE | Обработка задач через OpenCode session API       |
| `src/server.ts`       | CREATE | Express сервер с A2A эндпоинтами                |
| `server.mjs`          | CREATE | Точка входа для запуска сервера                 |
| `index.ts`            | UPDATE | Запуск сервера при serverMode: true             |

---

## NOT Building (Scope Limits)

- Динамическое обнаружение скилов — Phase 4 (использовать hardcoded)
- Push-уведомления — Future

---

## Step-by-Step Tasks

### Task 1: CREATE `src/executor.ts`

- **ACTION**: CREATE OpenCodeAgentExecutor
- **IMPLEMENT**:
  - Класс реализует AgentExecutor из @a2a-js/sdk
  - Метод execute(requestContext, eventBus) — основная логика
  - Метод processWithOpenCode(text) — взаимодействие с OpenCode:
    - Создать сессию: client.session.create()
    - Отправить prompt: client.session.prompt()
    - Получить ответ: client.session.messages()
    - Удалить сессию: client.session.delete()
  - Публикация событий: submitted, working, completed/failed
- **INTERFACE**:
```typescript
interface OpenCodeClient {
  session: {
    create: (params: {...}) => Promise<{ data?: { id: string } }>;
    prompt: (params: {...}) => Promise<unknown>;
    messages: (params: {...}) => Promise<{ data?: SessionMessage[] }>;
    delete: (params: {...}) => Promise<unknown>;
  };
}
```
- **VALIDATE**: `npx tsc --noEmit`

### Task 2: CREATE `src/server.ts`

- **ACTION**: CREATE A2A сервер
- **IMPLEMENT**:

**Agent Card endpoint:**
```typescript
app.get("/.well-known/agent-card.json", (req, res) => {
  res.json({
    name: config.agentName || "OpenCode Agent",
    description: config.agentDescription || "...",
    protocolVersion: "0.3.0",
    version: "0.1.0",
    url: serverUrl,
    skills: [ /* hardcoded for now */ ],
    capabilities: { streaming: true, pushNotifications: false },
  });
});
```

**JSON-RPC endpoints:**
- POST /a2a/jsonrpc — обработка JSON-RPC методов

**REST endpoints:**
- POST /message:send — отправить сообщение
- POST /message:stream — потоковая отправка (SSE)
- GET /tasks/:id — получить задачу
- POST /tasks/:id:cancel — отменить задачу
- POST /tasks/:id:subscribe — подписка на обновления

**Health checks:**
- GET /health — общий health check
- GET /health/ready — readiness check
- GET /health/live — liveness check

**Metrics:**
- GET /metrics — Prometheus metrics

- **IMPORTS**:
```typescript
import { jsonRpcHandler, restHandler, DefaultRequestHandler } from "@a2a-js/sdk/server/express";
import express from "express";
import promClient from "prom-client";
```
- **VALIDATE**: `npx tsc --noEmit`

### Task 3: CREATE `server.mjs`

- **ACTION**: CREATE точка входа для сервера
- **IMPLEMENT**:
  - Запуск сервера без OpenCode (standalone)
  - Загрузка конфигурации
  - Создание логгера (console fallback)
  - Запуск Express сервера
- **PATTERN**: ES module entry point
- **VALIDATE**: `node server.mjs` запускается

### Task 4: UPDATE `index.ts`

- **ACTION**: UPDATE интеграция сервера
- **IMPLEMENT**:
  - Импортировать startA2AServer из server.ts
  - При config.serverMode === true вызвать startA2AServer
  - Передать client и logger
- **MIRROR**: index.ts:124-127
- **VALIDATE**: `npx tsc --noEmit`

---

## A2A Server Endpoints (Required by Spec)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/agent-card.json` | GET | Agent Card для discovery |
| `/agentCard` | GET | Получить Agent Card |
| `/a2a/jsonrpc` | POST | JSON-RPC methods |
| `/a2a/rest` | POST | REST methods |
| `/message:send` | POST | Отправить сообщение |
| `/message:stream` | POST | Потоковая отправка (SSE) |
| `/tasks/{id}` | GET | Получить задачу |
| `/tasks/{id}:cancel` | POST | Отменить задачу |
| `/tasks/{id}:subscribe` | POST | Подписка (SSE) |
| `/health` | GET | Health check |
| `/health/ready` | GET | Readiness check |
| `/health/live` | GET | Liveness check |
| `/metrics` | GET | Prometheus metrics |

---

## Testing Strategy

### Edge Cases Checklist

- [ ] Сервер не запускается на занятом порту — обработать ошибку
- [ ] Нет client.session API — fallback на mock
- [ ] Сессия не создаётся — вернуть ошибку
- [ ] Timeout при обработке — отменить и вернуть ошибку

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
npx tsc --noEmit && npm run lint
```

**EXPECT**: Exit 0

### Level 2: BUILD

```bash
npm run build
```

**EXPECT**: Build succeeds

### Level 3: MANUAL_VALIDATION

1. Запустить сервер: `node server.mjs`
2. Проверить GET /.well-known/agent-card.json
3. Проверить GET /health
4. Проверить GET /metrics

---

## Acceptance Criteria

- [ ] Express сервер запускается на настроенном порту
- [ ] Agent Card доступен по стандартному пути
- [ ] JSON-RPC эндпоинты работают
- [ ] REST эндпоинты работают
- [ ] Health checks возвращают 200
- [ ] Prometheus metrics доступны
- [ ] Level 1: lint + typecheck проходят
- [ ] Level 2: build проходит

---

## Completion Checklist

- [ ] All tasks completed
- [ ] npx tsc --noEmit проходит
- [ ] npm run build проходит
- [ ] Сервер запускается без ошибок
- [ ] Все эндпоинты отвечают

---

## Notes

- Использовать @a2a-js/sdk/server/express для обработки запросов
- Порт и хост настраиваются через конфигурацию
- Для standalone запуска использовать server.mjs
- Metrics собирать через prom-client
