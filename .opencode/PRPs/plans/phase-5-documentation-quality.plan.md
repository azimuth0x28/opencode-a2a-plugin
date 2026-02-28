# Feature: Phase 5 - Документация и качество

## Summary

Создание документации и настройка инструментов качества: README.md, AGENTS.md, SKILL.md, CODE_STYLE.md, настройка biome линтера, проверка типов.

## User Story

As a разработчик
I want иметь документацию и инструменты качества
So that я могу поддерживать код и другие разработчики могут понять проект

## Problem Statement

Нет документации для пользователей и разработчиков. Нет настроенных линтеров и проверок качества.

## Solution Statement

Создать:
- README.md — основная документация
- AGENTS.md — документация для AI агентов
- SKILL.md — документация для OpenCode
- CODE_STYLE.md — правила оформления кода
- biome.json — конфигурация линтера

## Metadata

| Field            | Value                                             |
| ---------------- | ------------------------------------------------- |
| Type             | ENHANCEMENT                                       |
| Complexity       | LOW                                               |
| Systems Affected | README.md, AGENTS.md, SKILL.md, CODE_STYLE.md, biome.json |
| Dependencies     | @biomejs/biome ^2.4.4                             |
| Estimated Tasks  | 5                                                 |

---

## UX Design

### Before State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BEFORE STATE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Проект без документации                                                   │
│   • Нет README                                                              │
│   • Нет руководств для разработки                                          │
│   • Нет настроенных линтеров                                                │
│                                                                             │
│   PAIN_POINT: Сложно понять проект, сложно поддерживать                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### After State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AFTER STATE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Проект с документацией                                                    │
│   ├── README.md           — основная документация                          │
│   ├── AGENTS.md           — для AI агентов                                 │
│   ├── SKILL.md            — для OpenCode                                   │
│   ├── CODE_STYLE.md       — правила оформления                             │
│   └── biome.json          — конфигурация линтера                           │
│                                                                             │
│   VALUE_ADD: Легко понять проект, легко поддерживать                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Files to Change

| File                  | Action | Justification                                    |
| --------------------- | ------ | ------------------------------------------------ |
| `README.md`           | CREATE | Основная документация проекта                   |
| `AGENTS.md`           | CREATE | Документация для AI агентов                      |
| `SKILL.md`            | CREATE | Документация для OpenCode                        |
| `CODE_STYLE.md`       | CREATE | Правила оформления кода                          |
| `biome.json`          | CREATE | Конфигурация линтера                             |

---

## NOT Building (Scope Limits)

- Тесты — Future
- CI/CD — Future

---

## Step-by-Step Tasks

### Task 1: CREATE `README.md`

- **ACTION**: CREATE основная документация
- **CONTENTS**:
  - Название и описание плагина
  - Быстрый старт (установка, настройка)
  - Конфигурация (параметры, примеры)
  - Использование инструментов
  - Серверный режим
  - API reference
  - Разработка (build, test)
  - Ссылки на документацию

- **SECTIONS**:
```markdown
# A2A Protocol Plugin for OpenCode

## Quick Start

## Configuration

## Tools

## Server Mode

## Development
```

- **VALIDATE**: Файл создан, содержит все секции

### Task 2: CREATE `AGENTS.md`

- **ACTION**: CREATE документация для AI агентов
- **CONTENTS**:
  - Обзор архитектуры
  - Структура файлов
  - SDK типы и методы (ссылка на @a2a-js/sdk)
  - Доступные инструменты
  - Паттерны реализации
  - Ошибки которые нужно избегать

- **SECTIONS**:
```markdown
# AGENTS.md — A2A Plugin Development Guide

## Quick Start

## Architecture

## SDK Types

## Available Tools

## Correct Patterns

## Common Mistakes to Avoid
```

- **VALIDATE**: Файл создан, агент может понять проект

### Task 3: CREATE `SKILL.md`

- **ACTION**: CREATE документация для OpenCode
- **CONTENTS**:
  - Название скила
  - Описание
  - Когда использовать
  - Примеры использования

- **SECTIONS**:
```markdown
# A2A Plugin Skill

## Description

## When to Use

## Examples
```

- **VALIDATE**: Файл создан, OpenCode может использовать

### Task 4: CREATE `CODE_STYLE.md`

- **ACTION**: CREATE правила оформления
- **CONTENTS**:
  - TypeScript стиль
  - Именование (файлы, функции, классы)
  - Комментарии
  - Импорты
  - Ошибки
  - Логирование

- **SECTIONS**:
```markdown
# Code Style Guide

## TypeScript

## Naming

## Comments

## Error Handling

## Logging
```

- **VALIDATE**: Файл создан, правила понятны

### Task 5: CREATE `biome.json`

- **ACTION**: CREATE конфигурация линтера
- **IMPLEMENT**:
```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "off"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double"
    }
  }
}
```
- **VALIDATE**: `npx biome check .` работает

---

## Validation Commands

### Level 1: LINT

```bash
npx biome check .
```

**EXPECT**: Exit 0 или только warnings

### Level 2: FORMAT

```bash
npx biome format . --write
```

**EXPECT**: Файлы отформатированы

### Level 3: TYPECHECK

```bash
npx tsc --noEmit
```

**EXPECT**: No errors

---

## Acceptance Criteria

- [ ] README.md содержит все основные секции
- [ ] AGENTS.md понятен для AI агента
- [ ] SKILL.md корректен для OpenCode
- [ ] CODE_STYLE.md содержит правила
- [ ] biome.json настроен и работает
- [ ] Level 1: biome check проходит
- [ ] Level 2: format работает
- [ ] Level 3: typecheck проходит

---

## Completion Checklist

- [ ] All tasks completed
- [ ] README.md создан
- [ ] AGENTS.md создан
- [ ] SKILL.md создан
- [ ] CODE_STYLE.md создан
- [ ] biome.json создан и работает

---

## Notes

- Использовать @biomejs/biome для линтинга и форматирования
- Следовать существующим конвенциям проекта
- Документация должна быть понятна новым разработчикам
