## 1. Инфраструктура проекта

- [x] 1.1 Создать `package.json`: ноль runtime-зависимостей, dev-зависимости `typescript`, `@biomejs/biome`, `@types/bun`; скрипты `build` (`bun build src/index.ts --target=browser --outdir=dist`), `dev` (`bun build --watch ... --sourcemap` + статический сервер), `typecheck`, `lint`, `test`, `check` (`typecheck` + `lint` + `test`). Проверка: `bun install` проходит, `bun run` показывает все шесть скриптов, в `dependencies` пусто
- [x] 1.2 Создать строгий `tsconfig.json` с `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `moduleResolution: bundler`, DOM- и Bun-типами. Проверка: `bun run typecheck` проходит на пустой `src/`
- [x] 1.3 Создать `biome.json` (линтер + форматтер, стиль как в `plan.md`: 4 пробела, одинарные кавычки, без точки с запятой в конце строк). Проверка: `bun run lint` проходит на пустой `src/`
- [x] 1.4 Создать `index.html`: `canvas#game` на `100dvw`/`100dvh`, `touch-action: none`, `image-rendering: pixelated`, `overscroll-behavior: none` на `html, body`, подключение `./dist/index.js`. Проверка: при открытии через статический сервер в консоли браузера нет ошибок загрузки скрипта
- [x] 1.5 Дополнить `.gitignore` (`node_modules`, `dist`) и создать `Makefile` с целями `install`, `build`, `dev`, `check`, `test`. Проверка: `make check` выводит вывод `bun run check`

## 2. Плейсхолдерные данные

- [x] 2.1 Создать `public/data/levels/index.json` (манифест: `id`, `file`, `name`) и `public/data/levels/level-001.json` с рамкой из `wall`, блоком `soil` и стартом типа `road` в углу, для которого выигрышный маршрут «змейкой» очевиден. Проверка: оба файла парсятся (`bun -e "await Bun.file(...).json()"`), клетка `start` имеет тип `road`; сам маршрут проверяется тестом 3.5
- [x] 2.2 Создать `public/assets/sprites/atlas.json`: кадры `wall`, `soil`, `road` и `rabbit_0…rabbit_N` с `duration` у каждого кадра анимации, `meta.image` и `meta.size`. Проверка: JSON парсится, имена кадров покрывают все типы клеток и кадры анимации
- [x] 2.3 Создать `scripts/gen-atlas.ts`: минимальный PNG-энкодер на `node:zlib` (строки с фильтром 0, CRC32), рисует одноцветные квадраты 16×16 по координатам из `atlas.json`. Проверка: `bun scripts/gen-atlas.ts` создаёт `public/assets/sprites/atlas.png`, его `width`/`height` совпадают с `meta.size`

## 3. Core: правила игры

- [x] 3.1 `src/core/level-types.ts`: `CellType`, `Vec2`, `LevelData`, `LevelManifestItem`, `LevelManifest`, `AtlasFrame`, `AtlasMeta`, `SpriteAtlasJSON` и единственный `const`-массив допустимых типов клеток. Проверка: `bun run typecheck` проходит, `bun test src/core/level-types.test.ts` зелёный (набор значений совпадает с `CellType`)
- [x] 3.2 `src/core/game-state.ts` (`GameState`, `createEmptyState()`, `createGameState(level)`) и `src/core/grid-utils.ts` (`countSoil` с сужением типов под `noUncheckedIndexedAccess`). Проверка: тест создаёт состояние из уровня и сверяет `soilCount` с числом клеток `soil`
- [x] 3.3 `src/core/game-rules.ts`: `Dir`, `canMove` (возвращает целевую клетку или `null`), `tryMove` (асфальтирует входящую клетку, уменьшает `soilCount`, двигает игрока). Проверка: тесты `src/core/game.test.ts` — ход на `soil` проходит, отказ на `wall`, на `road`, за границей и на неизвестном направлении оставляет позицию, сетку и счётчик неизменными
- [x] 3.4 Инвариант «под игроком всегда `road`» и правило необратимости маршрута. Проверка: тест проходит маршрут «змейкой» и после каждого хода проверяет тип клетки под игроком и что возврат на старт и на свой асфальт отклоняется
- [x] 3.5 Победа: `solved` становится `true` при `soilCount === 0` и не меняется, пока есть `soil`; победа достигается без возврата на стартовую клетку. Проверка: тест в `src/core/game.test.ts` загружает реальный `public/data/levels/level-001.json`, проигрывает маршрут «змейкой» и сверяет `solved`, `soilCount === 0` и что игрок не на старте; тест с оставшейся `soil` оставляет `solved === false`

## 4. Загрузка данных уровня

- [x] 4.1 `src/data/levels-loader.ts`: `parseLevel(data: unknown): LevelData` с ручными проверками из D7 — `id` непустой, `width`/`height` положительные целые, `tiles.length === height`, длина строки `=== width`, элемент из `{'wall','soil','road'}`, `start` присутствует, в границах и указывает на `road`; каждая ошибка — `throw new Error` с причиной. Проверка: `src/data/levels-loader.test.ts` содержит по кейсу на каждый отказ и на валидный уровень, `bun test src/data/levels-loader.test.ts` зелёный
- [x] 4.2 `parseManifest(data: unknown)` и `loadManifest()`/`loadLevel(file)` на `fetch`, с проверкой совпадения идентификатора записи манифеста с идентификатором в файле уровня. Проверка: тест на манифест с несовпадающим `id` падает с ошибкой о расхождении
- [x] 4.3 Загрузка по реальным файлам `public/data/levels/` через `fetch` — проверить, что путь к уровню строится относительно `index.json`, чтобы страница работала из любой директории. Проверка: `bun run dev` и открытие страницы не дают 404 на `public/data/levels/*` (сеть вкладки без ошибок)

## 5. Ввод

- [x] 5.1 `src/input/direction.ts`: `decodeKey(key: string, repeat: boolean): Dir | null` (стрелки, игнор `repeat`) и `decodeSwipe(dx: number, dy: number, threshold: number): Dir | null` (порог по максимальной из осей, доминирующая ось). Проверка: `src/input/direction.test.ts` — четыре стрелки, нерелевантная клавиша, `repeat === true`, свайп по горизонтали и вертикали при преобладании одной оси, смещение ниже порога, нулевое смещение; `bun test src/input/direction.test.ts` зелёный
- [x] 5.2 `src/input/keyboard.ts` и `src/input/pointer.ts`: слушатели только передают `event.key`/`repeat` и разницу `clientX`/`clientY` в очередь `Dir[]`, владеет которой `src/index.ts`; для стрелок вызывается `preventDefault()`. Проверка: чтение кода показывает отсутствие собственной логики ходов и `src/index.ts` с очередью; фактическое поведение — на приёмке 8.2
- [x] 5.3 Проверить, что прокрутка и масштабирование страницы заблокированы стилями из 1.4, а не JS-обработчиками `touchmove`. Проверка: `grep` по `src/` не находит обработчиков `touchmove`/`wheel`

## 6. Представление

- [x] 6.1 `src/view/layout.ts`: `computeLayout(cssW, cssH, gridW, gridH): Layout` (размер тайла `floor(min(...))`, минимум 1, целочисленное смещение центрирования, `devicePixelRatio`) и `playerRect(x, y, layout)`. Проверка: `src/view/layout.test.ts` покрывает размер тайла при разных соотношениях сторон, минимум 1, целочисленность смещения и DPR; `bun test src/view/layout.test.ts` зелёный
- [x] 6.2 `src/view/sprite-atlas.ts`: загрузка `atlas.json`, затем `meta.image` относительно JSON; `tileSize` — ширина кадра `wall`; `getFrame(name)` бросает ошибку с именем кадра. Проверка: `src/view/sprite-atlas.test.ts` — доступны все имена с длительностями, неизвестное имя даёт ошибку, содержащую его, `tileSize` равен ширине `wall`
- [x] 6.3 `src/view/sprite-anim.ts`: `createSpriteAnimator(frames, durations)` → `{ advance(dtMs), current() }` с накоплением остатка по разным длительностям и зацикливанием. Проверка: тест `src/view/sprite-anim.test.ts` на разных длительностях, переходе через сумму цикла и продолжении фазы без сброса
- [x] 6.4 `src/view/canvas.ts`: backing store = CSS-размер × `devicePixelRatio`, `setTransform(dpr, 0, 0, dpr, 0, 0)`, `imageSmoothingEnabled = false`. Проверка: `canvas.width`/`height` равны CSS-размеру × DPR после ресайза, координаты `drawImage` приходят из `computeLayout`
- [x] 6.5 `src/view/renderer.ts`: offscreen-слой, `renderAll()`, `redrawTile(x, y)` ровно одной клетки, отрисовка игрока текущим кадром аниматора поверх спрайта своей клетки. Проверка: `redrawTile` вызывается только для клетки, сменившей тип; при `resize` вызывается `renderAll` (проверяется на приёмке 8.3)

## 7. Сборка частей

- [x] 7.1 `src/loop/game-loop.ts`: `requestAnimationFrame`, `dt` с clamp, `update(dt)` и `render()`. Проверка: цикл не накапливает скачки времени после возврата на вкладку (проверяется на приёмке 8.2)
- [x] 7.2 `src/index.ts`: bootstrap — загрузка атласа и первого уровня из манифеста, состояние из `createGameState`, инициализация рендерера, слушателей ввода и цикла; за один `update` берётся ровно один `Dir` через `shift()`, при успешном `tryMove` вызывается `redrawTile` для изменившейся клетки, при первом переходе `solved` в `true` пишется одно сообщение в `console`; ошибки загрузки ловятся и показываются без запуска цикла. Проверка: `bun run build` собирает `dist/index.js`, игра стартует, а при ошибке в данных цикл не запускается
- [x] 7.3 Слушатель `resize` пересчитывает раскладку и вызывает `renderAll()`. Проверка: изменение размера окна перестраивает поле без перезапуска игры (приёмка 8.3)

## 8. Приёмка

- [x] 8.1 `bun run check` (typecheck + lint + test) проходит целиком без ошибок и предупреждений. Проверка: зелёный вывод всех трёх этапов
- [x] 8.2 `bun run build`, затем ручное тестирование пользователем в браузере по чек-листу приёмки
