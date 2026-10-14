## Why

В генераторе есть только три сложности (`easy`/`normal`/`hard`), максимальной не хватает для опытных игроков: `hard` уже упирается в лимит поля 8×15, но остаётся проходимым за счёт простых прямых коридоров. Нужна сложность `nightmare` для самых запутанных уровней.

## What Changes

- В генератор добавляется сложность `nightmare`: поле всегда ровно `MAX_WIDTH` × `MAX_HEIGHT` (8×15, без джиттера и без кропа ниже максимума), ветвление маршрута с запретом простых односложных прямых коридоров.
- Тип `Difficulty` расширяется до `'easy' | 'normal' | 'hard' | 'nightmare'` в `src/gen/generator.ts`, `src/core/level-types.ts`, валидации манифеста `src/data/levels-loader.ts`, скрипте `scripts/gen-level.ts` и инструменте `tools/level-preview.ts`.
- В списке уровней для `nightmare` добавляется кружок-индикатор фиолетового цвета (`#a855f7`, виден на тёмном фоне экрана), остальные цвета без изменений; запись без `difficulty` по-прежнему без кружка.
- Валидация манифеста принимает `difficulty: nightmare`, старые значения продолжают работать.

## Capabilities

### New Capabilities
- Нет новых способностей — всё ложится на существующие.

### Modified Capabilities
- `level-generator`: приём `nightmare`, фиксированный размер 8×15, генерация без простых прямых коридоров.
- `level-loading`: манифест принимает `difficulty` `nightmare` (`easy` | `normal` | `hard` | `nightmare`).
- `level-select`: фиолетовый кружок (`#a855f7`) для `nightmare` в списке уровней.

## Impact

- Затронуты: `src/gen/generator.ts` (+ тесты), `src/core/level-types.ts`, `src/data/levels-loader.ts` (+ тесты), `src/view/ui.ts`, `scripts/gen-level.ts`, `tools/level-preview.ts` (+ собранный `tools/level-preview.js`, `src/gen/*.js` если коммитятся).
- Обратная совместимость: существующие уровни и `easy`/`normal`/`hard` не меняются; старые клиенты, проверяющие difficulty строгим списком из трёх, отклонят `nightmare` до обновления.
