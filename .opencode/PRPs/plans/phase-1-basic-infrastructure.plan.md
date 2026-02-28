# Feature: Phase 1 - Базовая инфраструктура

## Summary

Настройка основы плагина: TypeScript проект с ES modules, система конфигурации, логирование, типы, интеграция с @a2a-js/sdk.

## User Story

As a разработчик
I want чтобы проект был настроен с TypeScript, конфигурацией и логированием
So that я мог начать разработку функциональности плагина

## Problem Statement

Нет готовой основы проекта для A2A плагина. Нужно создать структуру, настроить зависимости, создать систему типов и конфигурации.

## Solution Statement

Создать базовую инфраструктуру:
- package.json с зависимостями
- tsconfig.json для TypeScript
- src/types.ts с типами плагина
- src/config.ts для загрузки конфигурации
- src/utils/logger.ts для логирования

## Metadata

| Field            | Value                                             |
| ---------------- | ------------------------------------------------- |
| Type             | NEW_CAPABILITY                                    |
| Complexity       | LOW                                               |
| Systems Affected | package.json, tsconfig.json, src/types.ts, src/config.ts, src/utils/ |
| Dependencies     | @a2a-js/sdk ^0.3.10, @opencode-ai/plugin ^1.2.15, zod ^3.22.0, uuid ^9.0.0 |
| Estimated Tasks  | 6                                                 |

---

## UX Design

### Before State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BEFORE STATE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Пустая директория проекта                                                 │
│                                                                             │
│   USER_FLOW: Нет ничего - нужно создать с нуля                              │
│   PAIN_POINT: Нет основы для разработки                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### After State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AFTER STATE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Настроенный TypeScript проект                                             │
│   ├── package.json (зависимости)                                           │
│   ├── tsconfig.json (конфигурация TS)                                      │
│   └── src/                                                                  │
│       ├── types.ts (типы плагина)                                          │
│       ├── config.ts (загрузка конфигурации)                                │
│       └── utils/                                                            │
│           ├── index.ts                                                      │
│           └── logger.ts (логирование)                                      │
│                                                                             │
│   VALUE_ADD: Готовая основа для разработки                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mandatory Reading

**External Documentation:**
| Source | Section | Why Needed |
|--------|---------|------------|
| [TypeScript ES Modules](https://www.typescriptlang.org/docs/handbook/modules/reference.html) | ES Modules | Настройка type: module |
| [@a2a-js/sdk npm](https://www.npmjs.com/package/@a2a-js/sdk) | README | SDK версия и зависимости |
| [Zod Validation](https://zod.dev/) | Introduction | Валидация конфигурации |

---

## Files to Change

| File                  | Action | Justification                                    |
| --------------------- | ------ | ------------------------------------------------ |
| `package.json`        | CREATE | Зависимости проекта                              |
| `tsconfig.json`       | CREATE | Конфигурация TypeScript                          |
| `src/types.ts`        | CREATE | Типы плагина                                     |
| `src/config.ts`       | CREATE | Загрузка конфигурации (JSONC + env vars)         |
| `src/utils/index.ts`  | CREATE | Экспорт утилит                                   |
| `src/utils/logger.ts` | CREATE | Централизованное логирование                     |

---

## NOT Building (Scope Limits)

- Инструменты (a2a-tools.ts) — Phase 2
- Сервер (server.ts) — Phase 3
- Клиент (client.ts) — Phase 2

---

## Step-by-Step Tasks

### Task 1: CREATE `package.json`

- **ACTION**: CREATE package.json с зависимостями
- **IMPLEMENT**:
```json
{
  "name": "@opencode-ai/a2a",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "dependencies": {
    "@a2a-js/sdk": "^0.3.10",
    "@opencode-ai/plugin": "^1.2.15",
    "uuid": "^9.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.4.4",
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "@types/uuid": "^9.0.7",
    "express": "^4.19.0",
    "typescript": "^5.9.3"
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "lint": "biome lint ."
  }
}
```
- **VALIDATE**: `npm install` проходит без ошибок

### Task 2: CREATE `tsconfig.json`

- **ACTION**: CREATE tsconfig.json для TypeScript
- **IMPLEMENT**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```
- **VALIDATE**: `npx tsc --noEmit` проходит

### Task 3: CREATE `src/types.ts`

- **ACTION**: CREATE типы плагина
- **IMPLEMENT**: Определить A2APluginConfig, A2AClientState, Logger, ListTasksRequest/Response, Push notification types
- **MIRROR**: Использовать типы из @a2a-js/sdk где возможно
- **IMPORTS**:
```typescript
import type { ClientFactory, Client } from "@a2a-js/sdk/client";
import type { Task, AgentCard } from "@a2a-js/sdk";
```
- **VALIDATE**: `npx tsc --noEmit`

### Task 4: CREATE `src/utils/logger.ts`

- **ACTION**: CREATE модуль логирования
- **IMPLEMENT**: 
  - Функция setLogger для установки глобального логгера
  - Функции log.info, log.warn, log.error
  - Интерфейс Logger
- **PATTERN**:
```typescript
interface Logger {
  log(params: {
    body: {
      service: string;
      level: string;
      message: string;
      extra?: Record<string, unknown>;
    };
  }): Promise<void>;
}
```
- **VALIDATE**: `npx tsc --noEmit`

### Task 5: CREATE `src/utils/index.ts`

- **ACTION**: CREATE экспорт утилит
- **IMPLEMENT**: Экспортировать logger функции
- **VALIDATE**: `npx tsc --noEmit`

### Task 6: CREATE `src/config.ts`

- **ACTION**: CREATE загрузчик конфигурации
- **IMPLEMENT**:
  - Загрузка из .opencode/a2a.jsonc (локальный)
  - Загрузка из ~/.config/opencode/a2a.json (глобальный)
  - Поддержка JSONC (JSON с комментариями)
  - Поддержка environment variables (A2A_PORT, A2A_HOST, etc.)
  - Zod валидация конфигурации
  - getDefaultConfig() для значений по умолчанию
- **DEFAULT_CONFIG**:
```typescript
{
  port: 4000,
  host: "localhost",
  agentName: "OpenCode Agent",
  streaming: true,
  pushNotifications: false,
  serverMode: false
}
```
- **VALIDATE**: `npx tsc --noEmit`

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
npm install && npx tsc --noEmit
```

**EXPECT**: Exit 0, зависимости установлены, типы компилируются

### Level 2: BUILD

```bash
npm run build
```

**EXPECT**: dist/ создан без ошибок

---

## Acceptance Criteria

- [ ] package.json содержит все зависимости
- [ ] tsconfig.json настроен для ES modules
- [ ] types.ts экспортирует типы плагина
- [ ] config.ts загружает конфигурацию из файлов и env vars
- [ ] logger.ts обеспечивает централизованное логирование
- [ ] Level 1: install + typecheck проходят
- [ ] Level 2: build проходит

---

## Completion Checklist

- [ ] All tasks completed in dependency order
- [ ] npm install проходит
- [ ] npx tsc --noEmit проходит
- [ ] npm run build проходит

---

## Notes

- Использовать ES modules (type: "module") для совместимости с Node.js
- Типы импортировать из @a2a-js/sdk, не дублировать
- Конфигурация ищется в порядке: локальный → глобальный → defaults
