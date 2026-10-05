# Roadbuilder — план минимальной заготовки

Цель: создать минимальный оффлайн браузерный проект логической игры "Roadbuilder" на чистом TypeScript с минимумом зависимостей.

## 1. Концепция игры

- **Вид сверху**, тайловая сетка типа шахматной доски
- В каждом тайле: `wall` (непроходимый), `soil` (проходимая земля), `road` (асфальтированная дорога)
- Игрок управляет кроликом по 4 направлениям: стрелки клавиатуры или свайп на тач-экране
- После хода кролик оставляет асфальт на клетке, с которой ушёл. **На эту клетку нельзя вернуться**
- Цель — заасфальтировать всю землю, чтобы не осталось ни одной клетки `soil`
- Есть **только одна** зацикленная спрайтовая анимация кролика (прыгает на месте), чисто декоративная, ни на что не влияет
- Работает **только в браузере**, **полностью оффлайн**

## 2. Принципы

- **0 runtime-зависимостей**. Только нативные Web API: `Canvas 2D`, `requestAnimationFrame`, `fetch()`, `HTMLImageElement`
- **Только dev-зависимости**: `typescript` + `@biomejs/biome`
- **Строгий TypeScript** + `Biome` для линтинга/форматирования
- **Чёткое разделение**: `core` (pure-логика, без DOM/Canvas) и `view` (отрисовка)
- **Data-driven**: уровни и атлас в JSON
- **Canvas 2D** + offscreen-слой тайловой карты
- **Time-based** анимация, независимая от ходов
- **Минимум абстракций**, максимум статических проверок

## 3. Конфиги

### package.json

```json
{
    "name": "roadbuilder",
    "private": true,
    "version": "0.0.1",
    "type": "module",
    "scripts": {
        "typecheck": "tsc --noEmit",
        "lint": "biome check .",
        "lint:fix": "biome check --write .",
        "dev": "bunx serve .",
        "check": "bun run typecheck && bun run lint"
    },
    "devDependencies": {
        "@biomejs/biome": "^2.2.4",
        "typescript": "^5.9.3"
    }
}
```

### tsconfig.json

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "ESNext",
        "moduleResolution": "Bundler",
        "lib": ["ES2022", "DOM", "DOM.Iterable"],
        "strict": true,
        "noUncheckedIndexedAccess": true,
        "exactOptionalPropertyTypes": true,
        "noImplicitReturns": true,
        "noImplicitOverride": true,
        "useUnknownInCatchVariables": true,
        "verbatimModuleSyntax": true,
        "isolatedModules": true,
        "noEmit": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true
    },
    "include": ["src"]
}
```

### biome.json

```json
{
    "$schema": "https://biomejs.dev/schemas/2.2.4/schema.json",
    "vcs": {"enabled": false, "clientKind": "git", "useIgnoreFile": false},
    "files": {"ignoreUnknown": false, "includes": ["src/**/*", "index.html"]},
    "formatter": {"enabled": true, "indentStyle": "space", "indentWidth": 2},
    "linter": {"enabled": true, "rules": {"recommended": true}},
    "javascript": {"formatter": {"quoteStyle": "single"}}
}
```

## 4. Структура проекта

```
roadbuilder/
├── biome.json
├── index.html
├── package.json
├── public/
│   ├── assets/
│   │   └── sprites/
│   │       ├── atlas.json
│   │       └── atlas.png
│   └── data/
│       └── levels/
│           ├── index.json
│           └── level-001.json
├── src/
│   ├── core/
│   │   ├── game-rules.ts
│   │   ├── game-state.ts
│   │   ├── grid-utils.ts
│   │   └── level-types.ts
│   ├── data/
│   │   └── levels-loader.ts
│   ├── index.ts
│   ├── input/
│   │   ├── keyboard.ts
│   │   └── pointer.ts
│   ├── loop/
│   │   └── game-loop.ts
│   └── view/
│       ├── canvas.ts
│       ├── renderer.ts
│       ├── sprite-anim.ts
│       └── sprite-atlas.ts
└── tsconfig.json
```

## 5. index.html

```html
<!doctype html>
<html lang="ru">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <title>Roadbuilder</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            html,
            body {
                height: 100%;
                background: #111;
            }
            canvas {
                display: block;
                width: 100dvw;
                height: 100dvh;
                touch-action: none;
                image-rendering: pixelated;
            }
        </style>
    </head>
    <body>
        <canvas id="game"></canvas>
        <script type="module" src="./src/index.ts"></script>
    </body>
</html>
```

## 6. Core-модели

### src/core/level-types.ts

```ts
export type CellType = 'wall' | 'soil' | 'road';

export interface Vec2 {
    x: number;
    y: number;
}

export interface LevelData {
    id: string;
    width: number;
    height: number;
    tiles: CellType[][];
    start?: Vec2;
}

export interface LevelManifestItem {
    id: string;
    file: string;
    name: string;
}

export interface LevelManifest {
    levels: LevelManifestItem[];
}

export interface AtlasFrame {
    frame: {x: number; y: number; w: number; h: number};
    duration?: number;
}

export interface AtlasMeta {
    image: string;
    size: {w: number; h: number};
}

export interface SpriteAtlasJSON {
    frames: Record<string, AtlasFrame>;
    meta: AtlasMeta;
}

export interface SpriteAtlas {
    image: HTMLImageElement;
    frames: Record<string, AtlasFrame>;
    tileSize: number;
}
```

### src/core/game-state.ts

```ts
import type {CellType, Vec2} from './level-types.ts';

export interface GameState {
    grid: CellType[][];
    width: number;
    height: number;
    player: Vec2;
    soilCount: number;
    solved: boolean;
}

export function createEmptyState(): GameState {
    return {
        grid: [],
        width: 0,
        height: 0,
        player: {x: 0, y: 0},
        soilCount: 0,
        solved: false,
    };
}
```

### src/core/grid-utils.ts

```ts
import type {CellType} from './level-types.ts';

export function countSoil(grid: CellType[][]): number {
    let n = 0;
    for (let y = 0; y < grid.length; y++) {
        const row = grid[y];
        if (!row) continue;
        for (let x = 0; x < row.length; x++) {
            if (row[x] === 'soil') n++;
        }
    }
    return n;
}
```

### src/core/game-rules.ts

```ts
import type {CellType, Vec2} from './level-types.ts';
import type {GameState} from './game-state.ts';

export type Dir = 'up' | 'down' | 'left' | 'right';

export function canMove(state: GameState, dir: Dir): Vec2 | null {
    const {player, grid, width, height} = state;
    let nx = player.x;
    let ny = player.y;
    if (dir === 'left') nx--;
    if (dir === 'right') nx++;
    if (dir === 'up') ny--;
    if (dir === 'down') ny++;

    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return null;
    const row = grid[ny];
    if (!row) return null;
    const t = row[nx];
    if (t === 'wall' || t === 'road') return null;
    if (t !== 'soil') return null;
    return {x: nx, y: ny};
}

export function tryMove(state: GameState, dir: Dir): boolean {
    const next = canMove(state, dir);
    if (!next) return false;

    const px = state.player.x;
    const py = state.player.y;

    const oldRow = state.grid[py];
    if (oldRow && oldRow[px] === 'soil') {
        oldRow[px] = 'road';
        state.soilCount--;
    } else {
        if (oldRow) oldRow[px] = 'road';
    }

    state.player = next;

    if (state.soilCount <= 0) {
        state.solved = true;
    }
    return true;
}
```

## 7. Игровая логика работы

### Модель хода

1. По вводу (keydown без repeat, либо свайп) кладём направление в pendingDir
2. В GameLoop.update(dt) разово применяем tryMove(state, pendingDir), если есть
3. При успешном ходе: клетка старта-позиции становится road, игрок переходит в новую клетку, soilCount--, при soilCount <= 0 флаг solved
4. Проходимо только на soil. Нельзя на wall и нельзя на road

### Координаты

- Логика: целочисленные (x, y) — колонка, строка
- Экран: dx = x _ tileSize, dy = y _ tileSize
- Canvas 2D, imageSmoothingEnabled = false, учёт devicePixelRatio

### Рендеринг

- Создаём offscreen-canvas под тайловый слой
- При загрузке уровня отрисовываем всю карту 1 раз по атласу
- При превращении soil -> road перерисовываем только прямоугольник tileSize×tileSize этой клетки
- В каждом кадре: drawImage(offscreen, 0,0) + отрисовка кролика текущим кадром аниматора

### Анимация

- SpriteAnimator time-based: time += dt, индекс кадра по доле time / durationMs
- Зациклена, не сбрасывается и не синхронизируется с ходами
- Берём фрейм по имени из atlas.json, рисуем через drawImage по UV

### Ввод

- Клавиатура: ArrowUp/Down/Left/Right. Игнорируем event.repeat === true. Один ход за срабатывание
- Свайп (Pointer Events): запоминаем pointerdown, по pointerup считаем dx,dy, берём доминирующую ось, порог ~16–24px, блокируем скролл touch-action: none

## 8. Тестовые ассеты (минимум для старта)

### public/data/levels/index.json

```json
{
    "levels": [{"id": "001", "file": "level-001.json", "name": "Test 1"}]
}
```

### public/data/levels/level-001.json

```json
{
    "id": "001",
    "width": 7,
    "height": 7,
    "tiles": [
        ["wall", "wall", "wall", "wall", "wall", "wall", "wall"],
        ["wall", "soil", "soil", "soil", "soil", "soil", "wall"],
        ["wall", "soil", "soil", "soil", "soil", "soil", "wall"],
        ["wall", "soil", "soil", "soil", "soil", "soil", "wall"],
        ["wall", "soil", "soil", "soil", "soil", "soil", "wall"],
        ["wall", "soil", "soil", "soil", "soil", "soil", "wall"],
        ["wall", "wall", "wall", "wall", "wall", "wall", "wall"]
    ],
    "start": {"x": 3, "y": 5}
}
```

> В tiles стартовая клетка должна быть soil. Поле start указывает позицию игрока.

### public/assets/sprites/atlas.json (минимальный)

```json
{
    "frames": {
        "wall": {"frame": {"x": 0, "y": 0, "w": 16, "h": 16}},
        "soil": {"frame": {"x": 16, "y": 0, "w": 16, "h": 16}},
        "road": {"frame": {"x": 32, "y": 0, "w": 16, "h": 16}},
        "rabbit_0": {"frame": {"x": 0, "y": 16, "w": 16, "h": 16}, "duration": 120},
        "rabbit_1": {"frame": {"x": 16, "y": 16, "w": 16, "h": 16}, "duration": 120}
    },
    "meta": {
        "image": "atlas.png",
        "size": {"w": 48, "h": 32}
    }
}
```

atlas.png — минимальный 48x32 спрайтшит (можно одноцветные квадратики 16x16). Достаточно для проверки отрисовки и анимации.

## 9. Модули view/input/loop/data/index

Набор файлов для реализации после core:

- src/view/canvas.ts — инициализация canvas, DPR, imageSmoothingEnabled=false
- src/view/sprite-atlas.ts — загрузка atlas.json + atlas.png, вычисление tileSize
- src/view/sprite-anim.ts — SpriteAnimator (time-based, loop)
- src/view/renderer.ts — offscreen tile-layer, redrawAllTiles(), redrawTile(), drawRabbit()
- src/input/keyboard.ts — буфер pendingDir, обработка keydown/keyup с учётом event.repeat
- src/input/pointer.ts — свайп через Pointer Events, порог + доминирующая ось, touch-action
- src/loop/game-loop.ts — requestAnimationFrame, dt с clamp, update(dt)+render()
- src/data/levels-loader.ts — loadManifest(), loadLevel(file) через fetch
- src/index.ts — bootstrap: загрузка ассетов + уровня -> инициализация ввода/рендерера/цикла

## 10. Порядок старта

1. Создать конфиги: package.json, tsconfig.json, biome.json
2. Создать index.html
3. Создать всю структуру src/ по списку выше
4. Написать core/\*
5. Создать минимальные ассеты в public/
6. Реализовать view/_, input/_, loop/_, data/_, index.ts
7. Проверка: bun run typecheck && bun run lint
8. Запуск: bun run dev -> открыть в браузере через локальный статический сервер

## 11. Цель первого прохода

Получить минимально рабочий скелет:

- Открывается index.html через bunx serve .
- Рендерится тайловая сетка из атласа
- Кролик стоит в start и крутит зацикленную анимацию
- Стрелками/свайпом можно сделать ход: старая клетка становится road, кролик перемещается, обратно вернуться нельзя
- При закрашивании всей soil solved = true

Никаких UI-надписей, меню, рестартов, звуков. Только базовая механика.
