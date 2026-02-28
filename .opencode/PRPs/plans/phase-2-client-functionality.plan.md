# Feature: Phase 2 - Клиентский функционал

## Summary

Реализация клиентского функционала: AuthInterceptor для аутентификации, client.ts с SDK wrappers, 4 основных инструмента (a2a_send, a2a_discover, a2a_task_status, a2a_cancel), интеграция с OpenCode plugin system.

## User Story

As a разработчик
I want использовать готовые инструменты для взаимодействия с A2A-агентами
So that я мог отправлять сообщения, получать статус задач и отменять их

## Problem Statement

Нет инструментов для взаимодействия с A2A-агентами из OpenCode. Каждый раз нужно писать custom code для подключения к агенту.

## Solution Statement

Создать:
- src/interceptor.ts — AuthInterceptor для Bearer token и API key
- src/client.ts — SDK wrapper функции
- src/tools/a2a-tools.ts — 4 инструмента
- Интеграция в index.ts

## Metadata

| Field            | Value                                             |
| ---------------- | ------------------------------------------------- |
| Type             | NEW_CAPABILITY                                    |
| Complexity       | MEDIUM                                           |
| Systems Affected | src/interceptor.ts, src/client.ts, src/tools/, index.ts |
| Dependencies     | @a2a-js/sdk ^0.3.10                               |
| Estimated Tasks  | 5                                                 |

---

## UX Design

### Before State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BEFORE STATE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   OpenCode                                                                   │
│        │                                                                    │
│        ▼                                                                    │
│   Нет инструментов для A2A                                                  │
│                                                                             │
│   USER_FLOW: Невозможно взаимодействовать с A2A-агентами                   │
│   PAIN_POINT: Нужно писать custom integration code                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### After State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AFTER STATE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   OpenCode                                                                   │
│        │                                                                    │
│        ▼                                                                    │
│   ┌─────────────────────────────────────┐                                   │
│   │  A2A Tools (4 штуки)                │                                   │
│   │  • a2a_send     → sendMessage       │                                   │
│   │  • a2a_discover → fetchAgentCard    │                                   │
│   │  • a2a_task_status → getTask        │                                   │
│   │  • a2a_cancel   → cancelTask        │                                   │
│   └─────────────────────────────────────┘                                   │
│        │                                                                    │
│        ▼                                                                    │
│   A2A Agent                                                                 │
│                                                                             │
│   VALUE_ADD: Готовые инструменты для работы с A2A                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|---------------|
| P0 | `src/types.ts` | all | Types to IMPORT |
| P1 | `index.ts` | 42-130 | Plugin pattern to FOLLOW |

**External Documentation:**
| Source | Section | Why Needed |
|--------|---------|------------|
| [@a2a-js/sdk npm](https://www.npmjs.com/package/@a2a-js/sdk) | Client factory | Как создавать клиента |
| [A2A Protocol Spec](https://a2a-protocol.org/v0.3.0/specification) | Message sending | sendMessage API |

---

## Patterns to Mirror

**CLIENT_FACTORY_PATTERN:**
```typescript
// SOURCE: index.ts:81-93
// COPY THIS PATTERN:
import { ClientFactory, ClientFactoryOptions } from "@a2a-js/sdk/client";

let factory: ClientFactory;
if (config.authToken || config.apiKey) {
  const interceptor = new AuthInterceptor(config.authToken, config.apiKey);
  factory = new ClientFactory(
    ClientFactoryOptions.createFrom(ClientFactoryOptions.default, {
      clientConfig: { interceptors: [interceptor] },
    }),
  );
} else {
  factory = new ClientFactory();
}
```

**TOOL_DEFINITION_PATTERN:**
```typescript
// SOURCE: src/tools/a2a-tools.ts:48-61
// COPY THIS PATTERN:
import { tool } from "@opencode-ai/plugin/tool";

export const a2a_send = tool({
  description: "Send message to A2A agent",
  schema: z.object({
    message: z.string(),
    agentUrl: z.string().optional(),
    blocking: z.boolean().optional(),
  }),
  execute: async (args, ctx) => { ... },
});
```

---

## Files to Change

| File                  | Action | Justification                                    |
| --------------------- | ------ | ------------------------------------------------ |
| `src/interceptor.ts`  | CREATE | AuthInterceptor для аутентификации              |
| `src/client.ts`       | CREATE | SDK wrapper функции                              |
| `src/tools/index.ts`  | CREATE | Экспорт инструментов                             |
| `src/tools/a2a-tools.ts` | CREATE | 4 инструмента                                 |
| `index.ts`            | UPDATE | Интеграция инструментов в плагин                 |

---

## NOT Building (Scope Limits)

- Серверный функционал — Phase 3
- Динамическое обнаружение скилов — Phase 4
- Push-уведомления — Future

---

## Step-by-Step Tasks

### Task 1: CREATE `src/interceptor.ts`

- **ACTION**: CREATE AuthInterceptor для аутентификации
- **IMPLEMENT**:
  - Класс AuthInterceptor implements RequestInterceptor
  - Добавляет Authorization: Bearer {token} заголовок
  - Добавляет X-API-Key: {key} заголовок
  - Конструктор принимает authToken и apiKey
- **IMPORTS**:
```typescript
import type { RequestInterceptor } from "@a2a-js/sdk/client";
```
- **PATTERN**: Использовать interceptor pattern из SDK
- **VALIDATE**: `npx tsc --noEmit`

### Task 2: CREATE `src/client.ts`

- **ACTION**: CREATE SDK wrapper функции
- **IMPLEMENT**: Экспортировать функции:
  - `createA2AClient(url, authToken?, apiKey?)` — создание клиента
  - `sendToA2AAgent(client, message, sessionId?, blocking?)` — отправка сообщения
  - `fetchAgentCard(url)` — получение Agent Card
  - `getTask(client, taskId)` — получение задачи
  - `cancelTask(client, taskId)` — отмена задачи
- **MIRROR**: index.ts:100-107 — lazy client getter pattern
- **ERROR_HANDLING**: Обрабатывать ошибки, форматировать сообщения
- **VALIDATE**: `npx tsc --noEmit`

### Task 3: CREATE `src/tools/a2a-tools.ts`

- **ACTION**: CREATE 4 инструмента
- **IMPLEMENT**:

**a2a_send:**
- description: "Send message to A2A agent and get response"
- schema: message (string), agentUrl (optional), blocking (optional)
- execute: вызывает sendToA2AAgent, форматирует ответ

**a2a_discover:**
- description: "Get agent capabilities via Agent Card"
- schema: agentUrl (string)
- execute: вызывает fetchAgentCard, форматирует capabilities

**a2a_task_status:**
- description: "Get task status and artifacts"
- schema: taskId (string), includeHistory (optional)
- execute: вызывает getTask, форматирует статус и артефакты

**a2a_cancel:**
- description: "Cancel running task"
- schema: taskId (string)
- execute: вызывает cancelTask, возвращает подтверждение

- **PATTERN**: Использовать tool() из @opencode-ai/plugin
- **VALIDATE**: `npx tsc --noEmit`

### Task 4: CREATE `src/tools/index.ts`

- **ACTION**: CREATE экспорт инструментов
- **IMPLEMENT**: Экспортировать все инструменты из a2a-tools.ts
- **VALIDATE**: `npx tsc --noEmit`

### Task 5: UPDATE `index.ts`

- **ACTION**: UPDATE интеграция инструментов
- **IMPLEMENT**:
  - Импортировать createA2ATools из tools
  - Создать tools с factory pattern
  - Вернуть tools в plugin return object
  - Добавить команды (a2a-send, a2a-discover) в config hook
- **MIRROR**: index.ts:130-166 — текущая структура
- **VALIDATE**: `npx tsc --noEmit && npm run lint`

---

## Testing Strategy

### Edge Cases Checklist

- [ ] Нет agentUrl в конфигурации — использовать default
- [ ] Аутентификация не настроена — работать без auth
- [ ] Агент недоступен — вернуть понятную ошибку
- [ ] Timeout при отправке — обработать с retry логикой

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
npx tsc --noEmit && npm run lint
```

**EXPECT**: Exit 0, no errors

### Level 2: BUILD

```bash
npm run build
```

**EXPECT**: Build succeeds

### Level 3: MANUAL_VALIDATION

1. Настроить agentUrl в конфигурации
2. Вызвать a2a_discover — получить Agent Card
3. Вызвать a2a_send с тестовым сообщением
4. Проверить получение ответа

---

## Acceptance Criteria

- [ ] AuthInterceptor добавляет заголовки аутентификации
- [ ] client.ts экспортирует функции для работы с SDK
- [ ] 4 инструмента зарегистрированы и работают
- [ ] Интеграция с OpenCode plugin system
- [ ] Level 1: lint + typecheck проходят
- [ ] Level 2: build проходит

---

## Completion Checklist

- [ ] All tasks completed in order
- [ ] npx tsc --noEmit проходит
- [ ] npm run lint проходит
- [ ] npm run build проходит

---

## Notes

- Использовать ClientFactory с правильными опциями
- Инструменты должны быть совместимы с OpenCode plugin system
- Форматировать ответы для читаемости (особенно артефакты)
