// src/core/game-rules.ts
var STEP = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};
function canMove(state, dir) {
  const step = STEP[dir];
  if (!step)
    return null;
  const x = state.player.x + step.x;
  const y = state.player.y + step.y;
  if (x < 0 || y < 0 || x >= state.width || y >= state.height)
    return null;
  return state.grid[y]?.[x] === "soil" ? { x, y } : null;
}
var DIRS = ["up", "down", "left", "right"];
function isStuck(state) {
  return DIRS.every((dir) => canMove(state, dir) === null);
}
function tryMove(state, dir) {
  const next = canMove(state, dir);
  if (!next)
    return false;
  const row = state.grid[next.y];
  const frameRow = state.frames[next.y];
  if (!row || !frameRow)
    return false;
  row[next.x] = "road";
  frameRow[next.x] = frameRow[next.x] === "s201" ? "r102" : "r101";
  state.player = next;
  state.soilCount--;
  if (state.soilCount === 0)
    state.solved = true;
  else
    state.stuck = isStuck(state);
  return true;
}

// src/core/grid-utils.ts
function countSoil(grid) {
  let n = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell === "soil")
        n++;
    }
  }
  return n;
}

// src/core/game-state.ts
function createGameState(level) {
  return {
    grid: level.grid.map((row) => [...row]),
    frames: level.tiles.map((row) => [...row]),
    width: level.width,
    height: level.height,
    player: { ...level.start },
    soilCount: countSoil(level.grid),
    solved: false,
    stuck: false
  };
}

// src/core/level-types.ts
function range(from, to) {
  const out = [];
  for (let n = from;n <= to; n++)
    out.push(String(n));
  return out;
}
var FRAME_NUMBERS = {
  wall: ["101", "201", ...range(301, 314), ...range(401, 415), ...range(501, 516)],
  soil: ["101", "102", "103", "201", "301", "302"],
  road: ["101", "102"]
};
var FRAME_PREFIX = { w: "wall", s: "soil", r: "road" };
function frameType(frame) {
  const type = FRAME_PREFIX[frame[0] ?? ""];
  if (type === undefined)
    return;
  return FRAME_NUMBERS[type].includes(frame.slice(1)) ? type : undefined;
}

// src/data/levels-loader.ts
var LEVELS_INDEX = "public/data/levels/index.json";
var FRAME_PATTERN = /^[wsr]\d+$/;
function fail(message) {
  throw new Error(message);
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseLevel(data) {
  if (!isRecord(data))
    fail("уровень: данные должны быть объектом");
  const { id, width, height, tiles, start, tileSeed } = data;
  if (typeof id !== "string" || id === "")
    fail("уровень: id должен быть непустой строкой");
  if (typeof width !== "number" || !Number.isInteger(width) || width <= 0) {
    fail(`уровень "${id}": width должен быть положительным целым числом`);
  }
  if (typeof height !== "number" || !Number.isInteger(height) || height <= 0) {
    fail(`уровень "${id}": height должен быть положительным целым числом`);
  }
  if (!Array.isArray(tiles))
    fail(`уровень "${id}": tiles должен быть массивом кадров`);
  if (tiles.length !== height) {
    fail(`уровень "${id}": высота массива клеток (${tiles.length}) не совпадает с height (${height})`);
  }
  const frames = [];
  const grid = [];
  for (const [y, row] of tiles.entries()) {
    if (!Array.isArray(row))
      fail(`уровень "${id}": строка ${y} должна быть массивом клеток`);
    if (row.length !== width) {
      fail(`уровень "${id}": длина строки ${y} (${row.length}) не совпадает с width (${width})`);
    }
    const frameRow = [];
    const typeRow = [];
    for (const cell of row) {
      const type = typeof cell === "string" && FRAME_PATTERN.test(cell) ? frameType(cell) : undefined;
      if (type === undefined)
        fail(`уровень "${id}": неизвестный кадр "${String(cell)}" в строке ${y}`);
      frameRow.push(cell);
      typeRow.push(type);
    }
    frames.push(frameRow);
    grid.push(typeRow);
  }
  for (const [y, row] of frames.entries()) {
    for (const [x, frame] of row.entries()) {
      if (frame === "s301" && row[x + 1] !== "s302") {
        fail(`уровень "${id}": кадр "s301" (${x}, ${y}) должен стоять слева от "s302"`);
      }
      if (frame === "s302" && row[x - 1] !== "s301") {
        fail(`уровень "${id}": кадр "s302" (${x}, ${y}) должен стоять справа от "s301"`);
      }
    }
  }
  if (start === undefined)
    fail(`уровень "${id}": не объявлена стартовая позиция`);
  if (!isRecord(start))
    fail(`уровень "${id}": стартовая позиция должна быть объектом { x, y }`);
  const { x, y } = start;
  if (typeof x !== "number" || !Number.isInteger(x) || typeof y !== "number" || !Number.isInteger(y)) {
    fail(`уровень "${id}": стартовая позиция должна содержать целые числа x и y`);
  }
  if (x < 0 || y < 0 || x >= width || y >= height) {
    fail(`уровень "${id}": стартовая позиция (${x}, ${y}) вне сетки ${width}x${height}`);
  }
  if (grid[y]?.[x] !== "road") {
    fail(`уровень "${id}": стартовая клетка (${x}, ${y}) должна иметь тип road`);
  }
  if (tileSeed !== undefined) {
    fail(`уровень "${id}": поле tileSeed запрещено — раскладка кадров статична`);
  }
  return { id, width, height, tiles: frames, grid, start: { x, y } };
}
function findManifestDuplicates(items) {
  const ids = new Map;
  const seeds = new Map;
  items.forEach((item, i) => {
    if (!isRecord(item))
      return;
    const { id, seed } = item;
    if (typeof id !== "string" || id === "")
      return;
    const at = { index: i + 1, id };
    ids.set(id, [...ids.get(id) ?? [], at]);
    if (typeof seed === "string" && seed !== "" && seed !== "---") {
      seeds.set(seed, [...seeds.get(seed) ?? [], at]);
    }
  });
  const out = [];
  for (const [value, at] of ids)
    if (at.length > 1)
      out.push({ kind: "id", value, entries: at });
  for (const [value, at] of seeds)
    if (at.length > 1)
      out.push({ kind: "seed", value, entries: at });
  out.sort((a, b) => (a.entries[1]?.index ?? 0) - (b.entries[1]?.index ?? 0));
  return out;
}
function parseManifest(data) {
  if (!isRecord(data))
    fail("манифест: данные должны быть объектом");
  const { levels } = data;
  if (!Array.isArray(levels))
    fail("манифест: поле levels должно быть массивом");
  const entries = [];
  for (const [i, item] of levels.entries()) {
    const place = `манифест: запись №${i + 1}`;
    if (!isRecord(item))
      fail(`${place} должна быть объектом`);
    const { id, seed, difficulty } = item;
    if (typeof id !== "string" || id === "")
      fail(`${place}: id должен быть непустой строкой`);
    if (seed !== undefined && (typeof seed !== "string" || seed === "")) {
      fail(`${place} (${id}): seed должен быть непустой строкой`);
    }
    if (difficulty !== undefined && difficulty !== "easy" && difficulty !== "normal" && difficulty !== "hard") {
      fail(`${place} (${id}): difficulty должен быть easy, normal или hard`);
    }
    entries.push({
      id,
      ...seed === undefined ? {} : { seed },
      ...difficulty === undefined ? {} : { difficulty }
    });
  }
  for (const dup of findManifestDuplicates(entries)) {
    const first = dup.entries[0];
    const second = dup.entries[1];
    if (first === undefined || second === undefined)
      continue;
    if (dup.kind === "id")
      fail(`манифест: запись №${second.index} (${second.id}): дублирующийся id`);
    fail(`манифест: запись №${second.index} (${second.id}): дублирующийся seed "${dup.value}" (уже у "${first.id}")`);
  }
  return { levels: entries };
}
async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok)
    fail(`не удалось загрузить ${url}: HTTP ${response.status}`);
  return response.json();
}
async function loadManifest(url = LEVELS_INDEX) {
  return parseManifest(await fetchJson(url));
}
async function loadLevel(id, manifestUrl = LEVELS_INDEX) {
  const file = `${id}.json`;
  const url = `${String(manifestUrl).replace(/[^/]*$/, "")}${file}`;
  const level = parseLevel(await fetchJson(url));
  if (level.id !== id) {
    fail(`расхождение идентификаторов: манифест — "${id}", файл "${file}" содержит "${level.id}"`);
  }
  return level;
}

// src/data/progress.ts
var PROGRESS_KEY = "rabik.done.v1";
var memFallback = [];
function defaultStore() {
  try {
    const s = globalThis.localStorage;
    if (!s)
      return null;
    return s;
  } catch {
    return null;
  }
}
function parseIds(raw) {
  if (!raw)
    return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data))
      return [];
    return data.filter((v) => typeof v === "string" && v !== "");
  } catch {
    return [];
  }
}
function loadDone(store) {
  const s = store === undefined ? defaultStore() : store;
  if (!s)
    return new Set(memFallback);
  try {
    return new Set(parseIds(s.getItem(PROGRESS_KEY)));
  } catch {
    return new Set(memFallback);
  }
}
function markDone(id, store) {
  if (!id)
    return loadDone(store);
  const done = loadDone(store);
  done.add(id);
  const ids = [...done];
  const s = store === undefined ? defaultStore() : store;
  if (!s) {
    memFallback = ids;
    return done;
  }
  try {
    s.setItem(PROGRESS_KEY, JSON.stringify(ids));
  } catch {
    memFallback = ids;
  }
  return done;
}

// src/input/direction.ts
function decodeKey(key, repeat) {
  if (repeat)
    return null;
  switch (key) {
    case "ArrowUp":
      return "up";
    case "ArrowDown":
      return "down";
    case "ArrowLeft":
      return "left";
    case "ArrowRight":
      return "right";
    default:
      return null;
  }
}
function decodeSwipe(dx, dy, threshold) {
  if (dx === 0 && dy === 0)
    return null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold)
    return null;
  if (Math.abs(dx) > Math.abs(dy))
    return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

// src/input/keyboard.ts
var ARROW_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
function attachKeyboard(queue) {
  window.addEventListener("keydown", (event) => {
    if (ARROW_KEYS.includes(event.key))
      event.preventDefault();
    const dir = decodeKey(event.key, event.repeat);
    if (dir)
      queue.push(dir);
  });
}

// src/input/pointer.ts
var SWIPE_THRESHOLD = 24;
function attachPointer(queue, canvas) {
  let startX = 0;
  let startY = 0;
  let tracking = false;
  canvas.addEventListener("pointerdown", (event) => {
    startX = event.clientX;
    startY = event.clientY;
    tracking = true;
  });
  window.addEventListener("pointerup", (event) => {
    if (!tracking)
      return;
    tracking = false;
    const dir = decodeSwipe(event.clientX - startX, event.clientY - startY, SWIPE_THRESHOLD);
    if (dir)
      queue.push(dir);
  });
}

// src/loop/game-loop.ts
var MAX_DT_MS = 100;
function createGameLoop(update, render) {
  let rafId = 0;
  let last = 0;
  let running = false;
  function frame(now) {
    if (!running)
      return;
    const dt = Math.min(now - last, MAX_DT_MS);
    last = now;
    update(dt);
    render();
    rafId = requestAnimationFrame(frame);
  }
  return {
    start() {
      if (running)
        return;
      running = true;
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    }
  };
}

// src/view/layout.ts
function readDpr() {
  return globalThis.devicePixelRatio || 1;
}
var MAX_TILE_SIZE = 130;
function computeLayout(cssW, cssH, gridW, gridH, dpr) {
  const ratio = dpr ?? readDpr();
  const tileSize = Math.min(MAX_TILE_SIZE, Math.max(1, Math.floor(Math.min(cssW / gridW, cssH / gridH))));
  return {
    tileSize,
    offsetX: Math.floor((cssW - tileSize * gridW) / 2),
    offsetY: Math.floor((cssH - tileSize * gridH) / 2),
    dpr: ratio
  };
}
function playerRect(x, y, layout) {
  return {
    x: layout.offsetX + x * layout.tileSize,
    y: layout.offsetY + y * layout.tileSize,
    width: layout.tileSize,
    height: layout.tileSize
  };
}

// src/view/canvas.ts
function applyCanvasSize(canvas, ctx, cssW, cssH, dpr) {
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
function setupCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new Error("canvas: не удалось получить контекст 2D");
  const resize = () => {
    applyCanvasSize(canvas, ctx, canvas.clientWidth, canvas.clientHeight, readDpr());
  };
  resize();
  return { ctx, resize };
}

// src/view/renderer.ts
var FACING_ANGLE = {
  up: 0,
  right: Math.PI / 2,
  down: Math.PI,
  left: -Math.PI / 2
};
function facingAngle(dir) {
  return FACING_ANGLE[dir] ?? 0;
}
function createRenderer(options) {
  const { ctx, tiles, rabbit, animator, getLayout, getFacing } = options;
  const layer = document.createElement("canvas");
  const layerCtx = layer.getContext("2d");
  if (!layerCtx)
    throw new Error("renderer: не удалось создать offscreen-слой");
  function drawCell(target, x, y, state, tileSize) {
    const name = state.frames[y]?.[x];
    if (!name)
      return;
    const { x: sx, y: sy, w, h } = tiles.getFrame(name).frame;
    target.drawImage(tiles.image, sx, sy, w, h, x * tileSize, y * tileSize, tileSize, tileSize);
  }
  function render(state) {
    const layout = getLayout();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
    ctx.drawImage(layer, layout.offsetX, layout.offsetY);
    const { x: sx, y: sy, w, h } = rabbit.getFrame(animator.current()).frame;
    const rect = playerRect(state.player.x, state.player.y, layout);
    const angle = facingAngle(getFacing());
    if (angle === 0) {
      ctx.drawImage(rabbit.image, sx, sy, w, h, rect.x, rect.y, rect.width, rect.height);
      return;
    }
    ctx.save();
    ctx.translate(rect.x + rect.width / 2, rect.y + rect.height / 2);
    ctx.rotate(angle);
    ctx.drawImage(rabbit.image, sx, sy, w, h, -rect.width / 2, -rect.height / 2, rect.width, rect.height);
    ctx.restore();
  }
  return {
    renderAll(state) {
      const layout = getLayout();
      layer.width = state.width * layout.tileSize;
      layer.height = state.height * layout.tileSize;
      layerCtx.imageSmoothingEnabled = false;
      for (let y = 0;y < state.height; y++) {
        for (let x = 0;x < state.width; x++) {
          drawCell(layerCtx, x, y, state, layout.tileSize);
        }
      }
      render(state);
    },
    redrawTile(x, y, state) {
      const layout = getLayout();
      const tileSize = layout.tileSize;
      layerCtx.clearRect(x * tileSize, y * tileSize, tileSize, tileSize);
      drawCell(layerCtx, x, y, state, tileSize);
      render(state);
    },
    render
  };
}

// src/view/sprite-anim.ts
function createSpriteAnimator(frames, durations) {
  if (frames.length === 0)
    throw new Error("аниматор: список кадров пуст");
  if (frames.length !== durations.length)
    throw new Error("аниматор: кадров и длительностей разное количество");
  if (durations.some((duration) => !Number.isFinite(duration) || duration <= 0)) {
    throw new Error("аниматор: длительность кадра должна быть положительной");
  }
  let elapsed = 0;
  let index = 0;
  return {
    advance(dtMs) {
      elapsed += dtMs;
      let duration = durations[index];
      while (duration !== undefined && elapsed >= duration) {
        elapsed -= duration;
        index = (index + 1) % frames.length;
        duration = durations[index];
      }
    },
    current() {
      const frame = frames[index];
      if (frame === undefined)
        throw new Error("аниматор: нет текущего кадра");
      return frame;
    }
  };
}

// src/view/sprite-atlas.ts
function fail2(message) {
  throw new Error(message);
}
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseRect(value, name) {
  if (!isRecord2(value))
    fail2(`атлас: кадр "${name}" должен содержать объект frame`);
  const { x, y, w, h } = value;
  if (typeof x !== "number" || typeof y !== "number" || typeof w !== "number" || typeof h !== "number") {
    fail2(`атлас: кадр "${name}": frame должен содержать числа x, y, w, h`);
  }
  if (w <= 0 || h <= 0)
    fail2(`атлас: кадр "${name}": frame должен иметь положительные w и h`);
  return { x, y, w, h };
}
function parseFramesAndMeta(data) {
  if (!isRecord2(data))
    fail2("атлас: данные должны быть объектом");
  const { frames, meta } = data;
  if (!isRecord2(frames))
    fail2("атлас: поле frames должно быть объектом");
  if (!isRecord2(meta))
    fail2("атлас: поле meta должно быть объектом");
  const { image, size } = meta;
  if (typeof image !== "string" || image === "")
    fail2("атлас: meta.image должен быть непустой строкой");
  if (!isRecord2(size) || typeof size.w !== "number" || typeof size.h !== "number") {
    fail2("атлас: meta.size должен содержать числа w и h");
  }
  const parsed = {};
  for (const [name, value] of Object.entries(frames)) {
    if (!isRecord2(value))
      fail2(`атлас: кадр "${name}" должен быть объектом`);
    const frame = { frame: parseRect(value.frame, name) };
    const duration = value.duration;
    if (duration !== undefined) {
      if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) {
        fail2(`атлас: кадр "${name}": duration должен быть положительным числом`);
      }
      frame.duration = duration;
    }
    parsed[name] = frame;
  }
  return { frames: parsed, meta: { image, size: { w: size.w, h: size.h } } };
}
function describeAtlas(frames, meta, tileSize) {
  return {
    frames,
    meta,
    tileSize,
    getFrame(name) {
      const frame = frames[name];
      if (!frame)
        fail2(`атлас: неизвестный кадр "${name}"`);
      return frame;
    }
  };
}
function parseAtlas(data) {
  const { frames, meta } = parseFramesAndMeta(data);
  const names = Object.keys(frames);
  const firstName = names[0];
  if (firstName === undefined)
    fail2("атлас: нет ни одного кадра статики");
  const first = frames[firstName];
  if (first === undefined)
    fail2("атлас: нет ни одного кадра статики");
  return describeAtlas(frames, meta, first.frame.w);
}
function parseAnimationAtlas(data) {
  const { frames, meta } = parseFramesAndMeta(data);
  const names = Object.keys(frames);
  const firstName = names[0];
  if (firstName === undefined)
    fail2("атлас: нет ни одного кадра анимации");
  const first = frames[firstName];
  if (first === undefined)
    fail2("атлас: нет ни одного кадра анимации");
  return describeAtlas(frames, meta, first.frame.w);
}
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image;
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`атлас: не удалось загрузить изображение "${url}"`));
    image.src = url;
  });
}
async function loadAtlas(jsonUrl) {
  const response = await fetch(jsonUrl);
  if (!response.ok)
    fail2(`атлас: не удалось загрузить ${jsonUrl}: HTTP ${response.status}`);
  const atlas = parseAtlas(await response.json());
  const imageUrl = `${String(jsonUrl).replace(/[^/]*$/, "")}${atlas.meta.image}`;
  const image = await loadImage(imageUrl);
  return { ...atlas, image };
}
async function loadAnimationAtlas(jsonUrl) {
  const response = await fetch(jsonUrl);
  if (!response.ok)
    fail2(`атлас: не удалось загрузить ${jsonUrl}: HTTP ${response.status}`);
  const atlas = parseAnimationAtlas(await response.json());
  const imageUrl = `${String(jsonUrl).replace(/[^/]*$/, "")}${atlas.meta.image}`;
  const image = await loadImage(imageUrl);
  return { ...atlas, image };
}

// src/view/ui.ts
var UI_ASSETS = {
  logo: "public/assets/ui/logo.png",
  play: "public/assets/ui/button/play.png",
  credits: "public/assets/ui/button/credits.png",
  backBtn: "public/assets/ui/button/back.png",
  done: "public/assets/ui/lvlsel/done.png",
  none: "public/assets/ui/lvlsel/none.png",
  art: "public/assets/ui/lvlsel/art.png",
  win: "public/assets/ui/modal/win.png",
  fail: "public/assets/ui/modal/fail.png",
  menu: "public/assets/ui/modal/menu.png"
};
var MODAL_ZONES = {
  win: {
    back: { left: 4, top: 52, width: 44, height: 43 },
    next: { left: 52, top: 52, width: 44, height: 43 }
  },
  fail: {
    back: { left: 4, top: 48, width: 30, height: 47 },
    restart: { left: 35, top: 48, width: 30, height: 47 },
    skip: { left: 66, top: 48, width: 30, height: 47 }
  },
  menu: {
    back: { left: 4, top: 40, width: 30, height: 45 },
    restart: { left: 35, top: 40, width: 29, height: 45 },
    next: { left: 65, top: 40, width: 31, height: 45 },
    close: { left: 80, top: 0, width: 19, height: 28 }
  }
};
var DIFFICULTY_COLORS = {
  easy: "#22c55e",
  normal: "#3b82f6",
  hard: "#ef4444"
};
function nextLevelId(levels, currentId) {
  const i = levels.findIndex((l) => l.id === currentId);
  return levels[i + 1]?.id ?? null;
}
function zoneButton(label, zone, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.setAttribute("aria-label", label);
  b.style.position = "absolute";
  b.style.left = `${zone.left}%`;
  b.style.top = `${zone.top}%`;
  b.style.width = `${zone.width}%`;
  b.style.height = `${zone.height}%`;
  b.style.background = "rgba(0,0,0,0)";
  b.style.border = "none";
  b.style.cursor = "pointer";
  b.addEventListener("click", onClick);
  return b;
}
function createUi(cb) {
  for (const src of Object.values(UI_ASSETS)) {
    const img = new Image;
    img.src = src;
  }
  const root = document.createElement("div");
  root.id = "ui";
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.zIndex = "10";
  root.style.pointerEvents = "none";
  document.body.append(root);
  const entry = document.createElement("div");
  entry.style.cssText = "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;background:linear-gradient(to top, #FFFFFF 0%, #BFE3FF 100%);pointer-events:auto";
  const logo = document.createElement("img");
  logo.src = UI_ASSETS.logo;
  logo.alt = "Road builder";
  logo.style.cssText = "max-width:min(420px,86vw);width:86vw";
  const play = document.createElement("button");
  play.type = "button";
  play.setAttribute("aria-label", "play");
  play.style.cssText = "background:none;border:none;cursor:pointer;padding:0";
  const playImg = document.createElement("img");
  playImg.src = UI_ASSETS.play;
  playImg.alt = "play";
  playImg.style.cssText = "width:220px;max-width:60vw";
  play.append(playImg);
  play.addEventListener("click", cb.onPlay);
  const creditsBtn = document.createElement("button");
  creditsBtn.type = "button";
  creditsBtn.setAttribute("aria-label", "credits");
  creditsBtn.style.cssText = "background:none;border:none;cursor:pointer;padding:0";
  const creditsImg = document.createElement("img");
  creditsImg.src = UI_ASSETS.credits;
  creditsImg.alt = "credits";
  creditsImg.style.cssText = "width:220px;max-width:60vw";
  creditsBtn.append(creditsImg);
  entry.append(logo, play, creditsBtn);
  const creditsModal = document.createElement("div");
  creditsModal.style.cssText = "position:absolute;inset:0;display:none;align-items:center;justify-content:center;pointer-events:auto";
  const creditsBackdrop = document.createElement("div");
  creditsBackdrop.style.cssText = "position:absolute;inset:0;background:rgba(0,0,0,0.5)";
  const creditsCard = document.createElement("div");
  creditsCard.style.cssText = "position:relative;background:#fff;color:#111;font:16px/1.5 sans-serif;border-radius:12px;padding:24px 28px;max-width:min(420px,90vw);text-align:left";
  const creditsTitle = document.createElement("div");
  creditsTitle.textContent = "Team:";
  creditsTitle.style.cssText = "font-weight:700;margin-bottom:8px";
  const creditsList = document.createElement("div");
  for (const line of [
    "Programmer: Dmitriy Shcherbakov",
    "Designer: Aleksandr Kalinin",
    "Illustrator: Alena Maltseva"
  ]) {
    const row = document.createElement("div");
    row.textContent = line;
    creditsList.append(row);
  }
  const creditsClose = document.createElement("button");
  creditsClose.type = "button";
  creditsClose.setAttribute("aria-label", "close credits");
  creditsClose.textContent = "✕";
  creditsClose.style.cssText = "position:absolute;top:8px;right:8px;background:none;border:none;cursor:pointer;font-size:18px;line-height:1;padding:4px";
  creditsCard.append(creditsTitle, creditsList, creditsClose);
  creditsModal.append(creditsBackdrop, creditsCard);
  entry.append(creditsModal);
  function hideCredits() {
    creditsModal.style.display = "none";
  }
  function showCredits() {
    creditsModal.style.display = "flex";
  }
  creditsBtn.addEventListener("click", showCredits);
  creditsClose.addEventListener("click", hideCredits);
  creditsBackdrop.addEventListener("click", hideCredits);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape")
      hideCredits();
  });
  const levels = document.createElement("div");
  levels.style.cssText = "position:absolute;inset:0;display:none;flex-direction:column;align-items:center;gap:16px;background:#111;padding:24px 16px;pointer-events:auto;overflow:auto";
  const list = document.createElement("div");
  list.style.cssText = "display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px;justify-items:center;max-width:520px;width:100%";
  const art = document.createElement("img");
  art.src = UI_ASSETS.art;
  art.alt = "";
  art.style.cssText = "max-width:min(520px,92vw);width:92vw;margin-top:auto";
  levels.append(list, art);
  const hud = document.createElement("button");
  hud.type = "button";
  hud.setAttribute("aria-label", "menu");
  hud.style.cssText = "position:absolute;top:12px;left:12px;display:none;background:none;border:none;cursor:pointer;pointer-events:auto;padding:0";
  const hudImg = document.createElement("img");
  hudImg.src = UI_ASSETS.backBtn;
  hudImg.alt = "menu";
  hudImg.style.cssText = "width:48px;height:48px";
  hud.append(hudImg);
  hud.addEventListener("click", cb.onMenu);
  const seedBadge = document.createElement("div");
  seedBadge.style.cssText = "position:absolute;top:12px;right:12px;display:none;color:#fff;font:14px/1 monospace;text-shadow:0 1px 2px #000;pointer-events:none";
  const modal = document.createElement("div");
  modal.style.cssText = "position:absolute;inset:0;display:none;align-items:center;justify-content:center;pointer-events:auto";
  const backdrop = document.createElement("div");
  backdrop.style.cssText = "position:absolute;inset:0;background:rgba(0,0,0,0.65)";
  const card = document.createElement("div");
  card.style.cssText = "position:relative;width:min(480px,92vw)";
  const modalImg = document.createElement("img");
  modalImg.alt = "";
  modalImg.style.cssText = "display:block;width:100%";
  card.append(modalImg);
  modal.append(backdrop, card);
  root.append(entry, levels, hud, seedBadge, modal);
  function renderModal(kind) {
    for (const b of card.querySelectorAll("button"))
      b.remove();
    if (kind === "none") {
      modal.style.display = "none";
      return;
    }
    modal.style.display = "flex";
    modalImg.src = kind === "win" ? UI_ASSETS.win : kind === "fail" ? UI_ASSETS.fail : UI_ASSETS.menu;
    const zones = MODAL_ZONES[kind];
    if (!zones)
      return;
    const actions = {
      back: cb.onBack,
      restart: cb.onRestart,
      next: cb.onNext,
      skip: cb.onNext,
      close: cb.onClose
    };
    for (const [name, zone] of Object.entries(zones)) {
      const fn = actions[name];
      if (!zone || !fn)
        continue;
      card.append(zoneButton(name, zone, fn));
    }
  }
  return {
    showEntry() {
      entry.style.display = "flex";
      levels.style.display = "none";
      hud.style.display = "none";
      seedBadge.style.display = "none";
      hideCredits();
      renderModal("none");
    },
    showLevels(manifest, done) {
      entry.style.display = "none";
      hud.style.display = "none";
      seedBadge.style.display = "none";
      hideCredits();
      renderModal("none");
      levels.style.display = "flex";
      list.textContent = "";
      for (const item of manifest.levels) {
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", `level ${item.id}`);
        b.style.cssText = "background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;color:#fff";
        const img = document.createElement("img");
        img.src = done.has(item.id) ? UI_ASSETS.done : UI_ASSETS.none;
        img.alt = done.has(item.id) ? `done ${item.id}` : `level ${item.id}`;
        img.style.cssText = "width:72px;height:72px;display:block";
        const wrap = document.createElement("div");
        wrap.style.cssText = "position:relative;width:72px;height:72px";
        wrap.append(img);
        const color = item.difficulty === undefined ? undefined : DIFFICULTY_COLORS[item.difficulty];
        if (color !== undefined) {
          const dot = document.createElement("div");
          dot.setAttribute("aria-label", `difficulty ${item.difficulty}`);
          dot.style.cssText = `position:absolute;right:4px;bottom:4px;width:12px;height:12px;border-radius:50%;background:${color};pointer-events:none`;
          wrap.append(dot);
        }
        const label = document.createElement("span");
        label.textContent = item.id;
        label.style.cssText = "font-size:14px;max-width:96px";
        b.append(wrap, label);
        b.addEventListener("click", () => cb.onPick(item.id));
        list.append(b);
      }
    },
    showGame(seed, id) {
      entry.style.display = "none";
      levels.style.display = "none";
      hud.style.display = "block";
      hideCredits();
      if (seed === undefined && id === undefined) {
        seedBadge.style.display = "none";
      } else {
        seedBadge.textContent = id === undefined ? seed ?? "" : seed === undefined ? `№${id}` : `№${id} · ${seed}`;
        seedBadge.style.display = "block";
      }
      renderModal("none");
    },
    showModal(kind) {
      if (kind === "none")
        renderModal("none");
      else {
        hud.style.display = "block";
        renderModal(kind);
      }
    }
  };
}

// src/index.ts
var TILES_JSON = "public/assets/sprites/tiles.json";
var RABBIT_JSON = "public/assets/sprites/rabbit.json";
function requireCanvas() {
  const canvas = document.getElementById("game");
  if (!(canvas instanceof HTMLCanvasElement))
    throw new Error('index: не найден <canvas id="game">');
  return canvas;
}
function showError(err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  const pre = document.createElement("pre");
  pre.textContent = `Ошибка загрузки: ${message}`;
  document.body.append(pre);
}
async function bootstrap() {
  const canvas = requireCanvas();
  const game = setupCanvas(canvas);
  const [tiles, rabbit, manifest] = await Promise.all([
    loadAtlas(TILES_JSON),
    loadAnimationAtlas(RABBIT_JSON),
    loadManifest()
  ]);
  if (manifest.levels.length === 0)
    throw new Error("манифест: нет ни одного уровня");
  const rabbitFrames = [];
  for (const [name, frame] of Object.entries(rabbit.frames)) {
    if (!name.startsWith("rabbit_"))
      continue;
    if (frame.duration === undefined)
      throw new Error(`анимация: кадр "${name}" без duration`);
    rabbitFrames.push([name, frame.duration]);
  }
  if (rabbitFrames.length === 0)
    throw new Error("анимация: в атласе нет кадров rabbit_*");
  rabbitFrames.sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  const animator = createSpriteAnimator(rabbitFrames.map(([name]) => name), rabbitFrames.map(([, duration]) => duration));
  let layout = computeLayout(canvas.clientWidth || 300, canvas.clientHeight || 300, 1, 1, readDpr());
  let facing = "up";
  const renderer = createRenderer({
    ctx: game.ctx,
    tiles,
    rabbit,
    animator,
    getLayout: () => layout,
    getFacing: () => facing
  });
  const queue = [];
  attachKeyboard(queue);
  attachPointer(queue, canvas);
  let state = null;
  let currentId = "";
  let screen = "entry";
  let modal = "none";
  let ui;
  const loop = createGameLoop((dtMs) => {
    animator.advance(dtMs);
    if (!state || screen !== "game" || modal !== "none") {
      queue.length = 0;
      return;
    }
    const dir = queue.shift();
    if (dir && tryMove(state, dir)) {
      facing = dir;
      renderer.redrawTile(state.player.x, state.player.y, state);
    }
    if (state.solved) {
      markDone(currentId);
      modal = "win";
      ui.showModal("win");
    } else if (state.stuck) {
      modal = "fail";
      ui.showModal("fail");
    }
  }, () => {
    if (state)
      renderer.render(state);
  });
  async function startLevel(id) {
    const entry = manifest.levels.find((l) => l.id === id);
    if (!entry)
      throw new Error(`манифест: уровень "${id}" не найден`);
    const level = await loadLevel(entry.id);
    state = createGameState(level);
    currentId = entry.id;
    facing = "up";
    screen = "game";
    modal = "none";
    queue.length = 0;
    layout = computeLayout(canvas.clientWidth, canvas.clientHeight, state.width, state.height, readDpr());
    renderer.renderAll(state);
    ui.showGame(entry.seed, entry.id);
    loop.start();
  }
  function openLevels() {
    screen = "levels";
    modal = "none";
    queue.length = 0;
    ui.showLevels(manifest, loadDone());
  }
  async function goNext() {
    const next = nextLevelId(manifest.levels, currentId);
    if (!next)
      openLevels();
    else
      await startLevel(next).catch(showError);
  }
  ui = createUi({
    onPlay: () => openLevels(),
    onPick: (id) => startLevel(id).catch(showError),
    onMenu: () => {
      if (screen !== "game" || !state)
        return;
      modal = "menu";
      ui.showModal("menu");
    },
    onBack: () => openLevels(),
    onRestart: () => {
      if (currentId)
        startLevel(currentId).catch(showError);
    },
    onNext: () => void goNext(),
    onClose: () => {
      modal = "none";
      ui.showModal("none");
    }
  });
  window.addEventListener("resize", () => {
    game.resize();
    if (state) {
      layout = computeLayout(canvas.clientWidth, canvas.clientHeight, state.width, state.height, readDpr());
      renderer.renderAll(state);
    }
  });
  ui.showEntry();
}
function registerServiceWorker() {
  if (!("serviceWorker" in navigator))
    return;
  const register = () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.warn(`sw: регистрация не удалась (${err instanceof Error ? err.message : String(err)})`);
    });
  };
  if (document.readyState === "complete")
    register();
  else
    window.addEventListener("load", register, { once: true });
}
registerServiceWorker();
bootstrap().catch(showError);
