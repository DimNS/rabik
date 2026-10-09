## Context

См. `proposal.md` (Why). Текущее состояние: `showLevels` в `src/view/ui.ts` кладёт кнопки в `flex-wrap` ленту без фиксированного числа в ряд; `difficulty` из манифеста игнорируется. `parseManifest` в `src/data/levels-loader.ts` проверяет тип `id`/`seed`/`difficulty`, но не уникальность. Тест реального `index.json` в `levels-loader.test.ts` устарел (ждёт 9 записей, реально 100).

## Goals / Non-Goals

**Goals:**
- 5 кнопок в ряд и индикатор сложности средствами существующего DOM/CSS без новых ассетов.
- Дубликаты `seed`/`id` падают как можно раньше — в `parseManifest`, покрытом `bun test` (входит в `make ai-check`).

**Non-Goals:**
- Пагинация, фильтры по сложности, редизайн кнопок.
- Проверка в `build.sh`.

## Decisions

- **Сетка 5 в ряд — CSS grid.** `list`: `display:grid; grid-template-columns:repeat(5, minmax(0,1fr)); gap:16px; max-width:520px`. Альтернатива `flex` с фиксированной шириной кнопки — отклонена: ломается при ресайзе, нужен пересчёт. Grid даёт 5 в ряд одной строкой CSS.
- **Кружок — `div` 12px поверх кнопки.** Обёртка вокруг `img` с `position:relative`, dot `position:absolute; right:4px; bottom:4px; width:12px; height:12px; border-radius:50%; pointer-events:none`. Мапа `easy→#22c55e, normal→#3b82f6, hard→#ef4444`, без `difficulty` — не рендерить. Альтернатива отдельные PNG — отклонена: лишний ассет ради трёхцветного круга.
- **Валидация — в `parseManifest`.** Два `Set`: `id` (все) и `seed` (только непустые и не `"---"`); дубликат → `throw` с номером записи и значением. Альтернативы отдельный `scripts/validate-levels.ts` или проверка в `build.sh` — отклонены: лишний файл/обходной путь мимо runtime; `parseManifest` уже вызывается и игрой (`loadManifest`), и тестами, и входит в `bun run check`.
- **Тесты — расширить `levels-loader.test.ts`.** Юниты на дубликаты `id`/`seed` и пропуск `"---"`/отсутствия `seed`; актуализировать тест реального `index.json` (100 записей, проверка уникальности вместо захардкоженного списка из 9).
- **Отдельный вызов — `scripts/check-levels.ts` + `make levels-lint`.** Тонкая обёртка над `parseManifest` для ручной проверки (логики не дублирует: весь список дубликатов собирает `findManifestDuplicates` из `levels-loader.ts`, им же пользуется `parseManifest`). При дубликатах печатает весь список, а не первую ошибку. В `check`/`ai-check` не входит — там дубликаты уже ловит `bun test`.

## Risks / Trade-offs

- [`index.json` был с 15 дубликатами `seed`] → данные почищены; тест проверяет чистый файл и ловит новые дубликаты.
- [Dot перекроет картинку `done/none`] → dot внутри relative-обёртки с `pointer-events:none`, клик остаётся на кнопке.
- [Сетка 5 колонок на узком экране] → `minmax(0,1fr)` + существующий `max-width`, кнопки сжимаются вместо горизонтального скролла.
