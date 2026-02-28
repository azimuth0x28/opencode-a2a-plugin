# Feature: Phase 4 - Динамическое обнаружение скилов

## Summary

Реализация динамического обнаружения скилов для A2A Agent Card. При запуске серверного режима плагин автоматически получает доступные команды и инструменты OpenCode через client.session API и преобразует их в A2A Skills.

## User Story

As a AI-инженер
I want чтобы Agent Card автоматически отражал актуальные возможности OpenCode
So that внешние системы видели все доступные команды без ручной настройки

## Problem Statement

Скилы в Agent Card захардкожены. При изменении команд в OpenCode, Agent Card не обновляется автоматически.

## Solution Statement

Создать:
- src/discovery.ts — получение команд/инструментов через session API
- src/skill-mapper.ts — преобразование в A2A AgentSkill[]
- Интеграция с server.ts

## Metadata

| Field            | Value                                             |
| ---------------- | ------------------------------------------------- |
| Type             | ENHANCEMENT                                       |
| Complexity       | MEDIUM                                           |
| Systems Affected | src/discovery.ts, src/skill-mapper.ts, src/server.ts |
| Dependencies     | @a2a-js/sdk ^0.3.10                               |
| Estimated Tasks  | 4                                                 |

---

## UX Design

### Before State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BEFORE STATE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Server Start                                                              │
│        │                                                                    │
│        ▼                                                                    │
│   ┌─────────────────┐                                                       │
│   │  Hardcoded      │  ◄── Static skills array                              │
│   │  skills: [...]  │       - "code-assistance"                             │
│   └─────────────────┘       - "code-review"                                 │
│            │                                                                │
│            ▼                                                                │
│   Static Agent Card                                                         │
│                                                                             │
│   PAIN_POINT: Скилы не обновляются при изменении команд                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### After State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AFTER STATE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Server Start                                                              │
│        │                                                                    │
│        ▼                                                                    │
│   ┌─────────────────┐                                                       │
│   │  discovery.ts   │  ◄── NEW: getCommands(), getTools()                  │
│   └────────┬────────┘       getPluginSkills()                              │
│            │                                                                │
│            ▼                                                                │
│   ┌─────────────────┐                                                       │
│   │  skill-mapper.ts│  ◄── NEW: mapToAgentSkills()                         │
│   └────────┬────────┘                                                       │
│            │                                                                │
│            ▼                                                                │
│   Dynamic Agent Card                                                        │
│                                                                             │
│   VALUE_ADD: Актуальные скилы из OpenCode                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|---------------|
| P0 | `src/server.ts` | 32-70 | Как генерируется Agent Card |
| P1 | `src/executor.ts` | 14-28 | OpenCodeClient interface |
| P2 | `src/types.ts` | all | Types to IMPORT |

**External Documentation:**
| Source | Section | Why Needed |
|--------|---------|------------|
| [A2A Protocol Spec - AgentSkill](https://a2a-protocol.org/v0.3.0/specification#554-agentskill-object) | AgentSkill Object | AgentSkill type definition |
| [A2A Protocol Spec - AgentCard](https://a2a-protocol.org/v0.3.0/specification#55-agentcard-object-structure) | AgentCard Structure | How to structure skills |

---

## Patterns to Mirror

**AGENT_CARD_PATTERN:**
```typescript
// SOURCE: src/server.ts:32-70
// COPY THIS PATTERN:
const agentCard = {
  name: config.agentName || "OpenCode Agent",
  description: config.agentDescription || "...",
  protocolVersion: "0.3.0",
  version: "0.1.0",
  url: serverUrl,
  skills: [ /* AgentSkill[] */ ],
  capabilities: { streaming: true, pushNotifications: false },
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
};
```

**INTERFACE_PATTERN:**
```typescript
// SOURCE: src/executor.ts:14-28
// COPY THIS PATTERN:
export interface OpenCodeClient {
  session: {
    create: (params: {...}) => Promise<...>;
    prompt: (params: {...}) => Promise<...>;
    messages: (params: {...}) => Promise<...>;
    delete: (params: {...}) => Promise<...>;
  };
}
```

---

## Files to Change

| File                  | Action | Justification                                    |
| --------------------- | ------ | ------------------------------------------------ |
| `src/discovery.ts`    | CREATE | Получение команд через session API              |
| `src/skill-mapper.ts` | CREATE | Преобразование в AgentSkill[]                   |
| `src/server.ts`       | UPDATE | Использовать динамические скилы                 |
| `src/index.ts`        | UPDATE | Экспортировать новые модули                     |

---

## NOT Building (Scope Limits)

- Кэширование скилов — Future
- Permission-based discovery — Future

---

## Step-by-Step Tasks

### Task 1: CREATE `src/discovery.ts`

- **ACTION**: CREATE модуль динамического обнаружения
- **IMPLEMENT**:
  - Функция discoverSkills(client: OpenCodeClient): Promise<DiscoveredSkill[]>
  - Вызов client.session.getCommands() — команды
  - Вызов client.session.getTools() — инструменты
  - Вызов client.session.getPluginSkills() — скилы плагинов
- **INTERFACE**:
```typescript
interface DiscoveredSkill {
  id: string;
  name: string;
  description: string;
  tags?: string[];
}
```
- **GOTCHA**: Методы session API могут не существовать — нужен fallback
- **VALIDATE**: `npx tsc --noEmit`

### Task 2: CREATE `src/skill-mapper.ts`

- **ACTION**: CREATE преобразование в AgentSkill
- **IMPLEMENT**:
  - Функция mapToAgentSkills(discovered: DiscoveredSkill[]): AgentSkill[]
  - Преобразование в A2A формат
  - Добавление inputModes/outputModes
- **IMPORTS**:
```typescript
import type { AgentSkill } from "@a2a-js/sdk";
```
- **AGENTSKILL_STRUCTURE**:
```typescript
interface AgentSkill {
  id: string;
  name: string;
  description: string;
  inputModes?: string[];
  outputModes?: string[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}
```
- **VALIDATE**: `npx tsc --noEmit`

### Task 3: UPDATE `src/server.ts`

- **ACTION**: UPDATE генерация Agent Card
- **IMPLEMENT**:
  - Импортировать discoverSkills и mapToAgentSkills
  - При старте сервера вызвать discovery
  - Использовать динамические скилы вместо hardcoded
- **MIRROR**: server.ts:32-70 — текущая структура Agent Card
- **GOTCHA**: Discovery async — добавить await при старте
- **VALIDATE**: `npx tsc --noEmit && npm run lint`

### Task 4: UPDATE `src/index.ts`

- **ACTION**: UPDATE экспорты
- **IMPLEMENT**:
  - Экспортировать discovery и skill-mapper
  - Убедиться что модули доступны
- **VALIDATE**: `npx tsc --noEmit`

---

## Testing Strategy

### Edge Cases Checklist

- [ ] Session API методы не существуют — fallback на пустой массив
- [ ] Пустой результат — вернуть пустой массив скилов
- [ ] Ошибка при discovery — логировать, продолжить с пустым
- [ ] Дубликаты ID — дедупликация по ID

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
npm run lint && npx tsc --noEmit
```

**EXPECT**: Exit 0

### Level 2: BUILD

```bash
npm run build
```

**EXPECT**: Build succeeds

### Level 3: MANUAL_VALIDATION

1. Запустить сервер с serverMode: true
2. GET /.well-known/agent-card.json
3. Проверить что skills не пустые

---

## Acceptance Criteria

- [ ] discovery.ts экспортирует discoverSkills
- [ ] skill-mapper.ts экспортирует mapToAgentSkills
- [ ] server.ts использует динамические скилы
- [ ] Level 1: lint + typecheck проходят
- [ ] Level 2: build проходит

---

## Completion Checklist

- [ ] All tasks completed
- [ ] npx tsc --noEmit проходит
- [ ] npm run lint проходит
- [ ] Agent Card содержит динамические скилы

---

## Notes

- Важно: Методы session API (getCommands, getTools, getPluginSkills) могут не существовать — проверить фактический API
- Альтернатива: Использовать другие источники если session API не предоставляет нужные методы
- Future: Добавить кэширование с TTL
