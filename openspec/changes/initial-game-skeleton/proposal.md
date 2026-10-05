## Why

Проект пуст: есть только план (`plan.md`) с описанием минимальной заготовки браузерной логической игры «Roadbuilder» и ни одной строки кода. Нужна рабочая основа, на которую потом лягут ассеты и геймплей: без неё нечего проверять и не на чем строить. Скелет делается первым, потому что он задаёт все дальнейшие контракты — формат уровней, формат атласа и разделение на `core`/`view`/`input`/`loop`/`data`, которое потом менять дорого.

## What Changes

- Появляется оффлайн-браузерная игра «вид сверху»: тайловая сетка, кролик, ходы по четырём направлениям.
- Новое правило асфальтирования: ход возможен только на `soil`, и клетка, на которую кролик вступил, сразу становится `road` — по своему асфальту вернуться нельзя; победа — когда не осталось ни одной `soil`.
- Игрок начинает на уже замощённой клетке `road`: с неё можно уйти, но вернуться нельзя, и целью партии она не является.
- Управление двумя способами: стрелки клавиатуры и свайп по тач-экрану, один ход на срабатывание.
- Отрисовка на Canvas 2D: тайловый слой рисуется в offscreen-канвас один раз при загрузке уровня, при `soil → road` перерисовывается только один тайл; кролик — зацикленная time-based анимация, не зависящая от ходов.
- Данные уровней и спрайтов вынесены в JSON (`public/data/levels/*.json`, `public/assets/sprites/atlas.json`) — уровни и атлас data-driven, не захардкожены в коде.
- Инфраструктура проекта: `package.json`, `bun`, `tsconfig.json` (строгий), `biome.json`, `index.html`, `Makefile`, dev-скрипты `typecheck` / `lint` / `test` / `check`.
- Ноль runtime-зависимостей, только нативные Web API; dev-зависимости — `typescript`, `@biomejs/biome`, `@types/bun`.
- Юнит-тесты на `bun test` для правил, парсера уровней, разбора ввода и раскладки; игровой код пишется так, что содержательная логика — чистые функции, а DOM только читает события и рисует.
- Ассеты на этом проходе — временные: минимальный атлас-заглушка и тестовый уровень, чтобы проверить отрисовку, движение и победу.
- Вне scope: UI-надписи, меню, рестарт, звук, победа как экран, несколько уровней со сложностью.

## Capabilities

### New Capabilities
<!-- Capabilities being introduced. Use kebab-case for path segments you introduce
     (e.g., user-auth or identity/user-auth) that follow the project's existing
     spec organization. Each creates specs/<capability-path>/spec.md. -->
- `game-rules`: правила хода и правило асфальтирования — проходимость, запрет возврата на `road`, старт на замощённой клетке, подсчёт `soil`, условие победы.
- `level-loading`: загрузка манифеста уровней и отдельного уровня из JSON, разбор тайлов, стартовой позиции и счётчика `soil`.
- `player-input`: ввод со стрелок клавиатуры и свайпа, преобразование ввода в одно направление, защита от повторов и от прокрутки страницы.
- `game-rendering`: Canvas-рендеринг тайловой сетки из атласа, offscreen-слой и точечная перерисовка, зацикленная анимация кролика, учёт devicePixelRatio.

### Modified Capabilities
<!-- Existing capabilities whose REQUIREMENTS are changing (not just implementation).
     Only list here if spec-level behavior changes. Each needs a delta spec file.
     Use the exact existing path under openspec/specs/. Leave empty if no requirement
     changes. A change with no capabilities at all (pure refactor, tooling, docs)
     must set `skip_specs: true` in its .openspec.yaml - openspec validate rejects
     a zero-delta change without that marker. Do not invent a requirement just to
     satisfy validation. -->
- Нет: это первое изменение, `openspec/specs/` пуст.

## Impact

- Новые файлы почти везде: `index.html`, `package.json`, `tsconfig.json`, `biome.json`, `public/data/levels/`, `public/assets/sprites/`, `src/core/`, `src/data/`, `src/input/`, `src/loop/`, `src/view/`, `src/index.ts`, тесты `src/**/*.test.ts`.
- Нет затронутого существующего кода — репозиторий пуст.
- Зависимости: ноль runtime, три dev-зависимости (`typescript`, `@biomejs/biome`, `@types/bun`); TypeScript собирается в бандл одной командой `bun build src/index.ts --outdir=dist` (браузер не исполняет `.ts` нативно), запуск — статический сервер (`bunx serve .`), тесты — `bun test`.
- Ассеты — заглушки. Контракт зафиксирован (`atlas.json` с именованными фреймами `wall`/`soil`/`road`/`rabbit_*` рядом с `atlas.png` в `public/assets/sprites/`), но реальные изображения пользователь предоставит позже отдельным изменением; до тех пор атлас генерируется минимально, чтобы проверить рендеринг и анимацию.
- Проверка приёмки: `bun run check` (typecheck + lint + test) проходит, в браузере по стрелкам и свайпу можно замостить весь `soil` тестового уровня, не возвращаясь на стартовую клетку.
