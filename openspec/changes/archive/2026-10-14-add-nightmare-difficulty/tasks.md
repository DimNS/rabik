## 1. Генератор nightmare

- [x] 1.1 Расширить `Difficulty` до `'easy' | 'normal' | 'hard' | 'nightmare'`, добавить пресет `nightmare { w: 8, h: 15, cover 0.6 }`, фиксировать размер 8×15 без джиттера/кропа ниже максимума и verify: `generateLevel({ difficulty: 'nightmare', seed })` всегда возвращает 8×15
- [x] 1.2 Добавить пост-фильтр простых коридоров (макс. длина прямого отрезка + наличие ветвлений/поворотов, отброс кандидата, повышенный лимит попыток) и verify: генерация nightmare за <2с, длинные прямые отсутствуют, `solveLevel` не null
- [x] 1.3 Обновить `scripts/gen-level.ts` и `tools/level-preview.ts` (приём `nightmare`) и verify: `gen-level --difficulty nightmare --seed <s>` выводит валидный JSON, проходящий `parseLevel` и `solveLevel`

## 2. Манифест и типы

- [x] 2.1 Расширить `difficulty` в `LevelManifestItem` (`src/core/level-types.ts`) и валидацию `parseManifest` (`src/data/levels-loader.ts`) до `nightmare` и verify: юнит-тест `parseManifest` принимает `nightmare` и отклоняет мусор

## 3. UI списка уровней

- [x] 3.1 Добавить `nightmare: '#a855f7'` в `DIFFICULTY_COLORS` (`src/view/ui.ts`) и verify: кнопка уровня с `difficulty: nightmare` показывает фиолетовый кружок 12px в правом нижнем углу, остальные цвета без изменений

## 4. Тесты и проверка

- [x] 4.1 Расширить `generator.test.ts` (размер/детерминизм/проходимость для всех сложностей включая `nightmare`) и verify: `bun test src/gen/generator.test.ts` зелёный
- [x] 4.2 Запустить `make ai-check` и verify: проверки проходят без ошибок
